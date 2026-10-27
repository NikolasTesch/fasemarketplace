// Browser contract tests: synthetic HTTP fixtures, no writes to an application DB.
import assert from 'node:assert/strict';
const origin=process.env.WORKSPACE_UI_ORIGIN||'http://127.0.0.1:4873';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const admin={id:'fixture-admin',name:'Administrador de teste',email:'admin@example.test',role:'admin',mustChangePassword:false,banned:false};
const product={id:'product-test',name:'Produto de teste',description:'Cadastro de teste',active:true,version:1,createdAt:'2026-10-27',variantCount:1,variants:[{id:'variant-test',productId:'product-test',name:'Padrão',sku:'TEST-01',active:true,effectiveActive:true,version:1}]};
const stock={variantId:'variant-test',productId:'product-test',productName:'Produto de teste',name:'Padrão',sku:'TEST-01',physicalReserve:0,sharedChannel:null,shopee:0,mercadoLivre:0,total:0,minimumQuantity:5,minimumVersion:1,belowMinimum:true};
const stockItems=Array.from({length:21},(_,index)=>({...stock,variantId:'variant-'+String(index+1).padStart(2,'0'),sku:'TEST-'+String(index+1).padStart(2,'0')}));
const errors=[];
async function contextFor(user){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 let signed=true,conflict=false,movementCreated=false,minimumUpdated=false,stockScenario='normal',failNextMovement=false;const movementKeys=[],acceptedMovementKeys=new Set();
 await context.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/access/session')return json(signed?{user}:{},signed?200:401);
  if(url.pathname==='/api/access/logout'){signed=false;return json({success:true});}
  if(url.pathname==='/api/access/users/fixture-user/password'){await new Promise(resolve=>setTimeout(resolve,400));return json({success:true});}
  if(url.pathname==='/api/access/users')return json({users:[admin,{...admin,id:'fixture-user',name:'Pessoa de teste',email:'person@example.test',role:'user'}],total:2});
  if(url.pathname==='/api/catalog/products'&&request.method()==='GET')return json({items:[product],total:1,offset:0,limit:20});
  if(url.pathname.startsWith('/api/catalog/')&&request.method()==='POST'){if(conflict)return json(product);conflict=true;return json({message:'SKU já cadastrado ou repetido'},409);}
  if(url.pathname==='/api/inventory/stock'){
   if(stockScenario==='loading')await new Promise(resolve=>setTimeout(resolve,350));
   if(stockScenario==='error')return json({message:'unavailable'},503);
   if(stockScenario==='empty')return json({items:[],total:0,offset:0,limit:20,mode:'SEPARATE'});
   if(stockScenario==='shared')return json({items:[{...stock,physicalReserve:3,sharedChannel:2,shopee:null,mercadoLivre:null,total:5,belowMinimum:true}],total:1,offset:0,limit:20,mode:'SHARED'});
   if(stockScenario!=='paged')return json({items:[stock],total:1,offset:0,limit:20,mode:'SEPARATE'});
   const offset=Number(url.searchParams.get('offset')||0);return json({items:stockItems.slice(offset,offset+20),total:stockItems.length,offset,limit:20,mode:'SEPARATE'});
  }
  if(url.pathname==='/api/inventory/movements'&&request.method()==='GET')return json({items:[],total:0,offset:0,limit:20});
  if(url.pathname==='/api/inventory/settings')return json({mode:'SEPARATE',version:1});
  if(url.pathname==='/api/inventory/variants/variant-test/minimum'&&request.method()==='POST'){minimumUpdated=true;return json({variantId:'variant-test',minimumQuantity:5,version:2});}
  if(url.pathname==='/api/inventory/settings/mode'&&request.method()==='POST')return json({mode:'SHARED',version:2});
  if(url.pathname==='/api/inventory/movements'&&request.method()==='POST'){const input=request.postDataJSON();movementKeys.push(input.idempotencyKey);if(acceptedMovementKeys.has(input.idempotencyKey))return json({message:'duplicate idempotency key'},409);acceptedMovementKeys.add(input.idempotencyKey);movementCreated=true;if(failNextMovement){failNextMovement=false;return route.abort('internetdisconnected');}return json({id:'movement-test',createdAt:new Date().toISOString()},201);}
  return json({},503);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 return {context,page,conflicted:()=>conflict,movementCreated:()=>movementCreated,movementKeys,acceptedMovementCount:()=>acceptedMovementKeys.size,minimumUpdated:()=>minimumUpdated,setStockScenario:value=>{stockScenario=value;},setFailNextMovement:value=>{failNextMovement=value;}};
}
try{
 const {context,page,conflicted,movementCreated,movementKeys,acceptedMovementCount,minimumUpdated,setStockScenario,setFailNextMovement}=await contextFor(admin);
 await page.getByRole('heading',{name:'Estoque físico',exact:true}).waitFor();
 await page.getByRole('button',{name:'Catálogo',exact:true}).click();
 await page.getByRole('heading',{name:'Catálogo de produtos',exact:true}).waitFor();
 assert.equal(await page.locator('.access-header').count(),0,'redundant account bar must be removed');
 assert.equal(await page.getByRole('button',{name:'Lançar Movimentação',exact:true}).count(),1);
 assert.equal(await page.locator('.inv-sidebar').getByRole('button',{name:'Lançar Movimentação',exact:true}).count(),1);
 assert.equal(await page.getByText('Sincronização & Alertas',{exact:true}).count(),0);
 assert.equal(await page.getByText('Itaquera / SP',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Trocar minha senha',exact:true}).count(),0);
 await page.getByRole('button',{name:'Editar produto Produto de teste',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 assert.match(await dialog.innerText(),/Produto de teste/);
 await dialog.getByLabel('Descrição',{exact:true}).fill('Rascunho');
 await dialog.getByRole('button',{name:'Salvar alterações',exact:true}).click();
 await dialog.getByRole('alert').filter({hasText:'SKU já cadastrado'}).waitFor();
 assert.equal(await dialog.getByLabel('Descrição',{exact:true}).inputValue(),'Rascunho');assert.equal(conflicted(),true);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'Editar produto Produto de teste',exact:true}).evaluate(e=>e===document.activeElement),true);
 await page.getByRole('button',{name:'Editar produto Produto de teste',exact:true}).click();await dialog.getByRole('button',{name:'Salvar alterações',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByText('Produto atualizado.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Editar produto Produto de teste',exact:true}).evaluate(e=>e===document.activeElement),true,'successful save restores focus after refreshing list');
 await page.getByRole('button',{name:'Adicionar variante em Produto de teste',exact:true}).click();await dialog.waitFor();
 await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Usuários',exact:true}).click();await page.getByRole('heading',{name:'Usuários',exact:true}).waitFor();
 await page.getByText('person@example.test',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cadastrar usuário',exact:true}).click();await dialog.getByRole('heading',{name:'Novo usuário',exact:true}).waitFor();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Redefinir senha',exact:true}).click();await dialog.getByLabel('Nova senha provisória',{exact:true}).fill('Synthetic-New-Password-2026!');page.once('dialog',native=>native.accept());await dialog.getByRole('button',{name:'Confirmar redefinição',exact:true}).click();
 assert.equal(await dialog.getByRole('button',{name:'Cancelar',exact:true}).isDisabled(),true,'reset cannot be cancelled in flight');await dialog.waitFor({state:'hidden'});
 await page.getByLabel('Pesquisar nesta página',{exact:true}).fill('não existe');await page.getByText('Nenhum usuário encontrado nesta página.',{exact:true}).waitFor();
 await page.locator('.access-password-settings summary').click();await page.getByRole('heading',{name:'Trocar senha',exact:true}).waitFor();
 await page.getByRole('button',{name:'Estoque físico',exact:true}).click();await page.getByRole('heading',{name:'Estoque físico',exact:true}).waitFor();
 await page.getByText('TEST-01',{exact:true}).waitFor();await page.getByText('Estoque mínimo atingido',{exact:true}).first().waitFor();assert.equal(await page.getByText('0',{exact:true}).count()>0,true,'zero balance is displayed as a persisted stock value');
 await page.getByRole('button',{name:'Salvar mínimo',exact:true}).click();await page.getByText('Estoque mínimo atualizado.',{exact:true}).waitFor();assert.equal(minimumUpdated(),true);
 setStockScenario('loading');await page.getByRole('button',{name:'Recarregar',exact:true}).click();await page.getByText('Carregando saldos…',{exact:true}).waitFor();await page.getByText('TEST-01',{exact:true}).waitFor();
 setStockScenario('error');await page.getByRole('button',{name:'Recarregar',exact:true}).click();await page.getByRole('alert').filter({hasText:'Estoque indisponível'}).waitFor();
 setStockScenario('empty');await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByRole('heading',{name:'Nenhuma variante ativa no catálogo',exact:true}).waitFor();
 setStockScenario('shared');await page.getByRole('button',{name:'Recarregar',exact:true}).click();await page.getByText('Compartilhado · Shopee e Mercado Livre',{exact:true}).waitFor();
 setStockScenario('normal');await page.getByRole('button',{name:'Recarregar',exact:true}).click();await page.getByText('TEST-01',{exact:true}).waitFor();
 setStockScenario('paged');
 await page.getByRole('button',{name:'Lançar Movimentação',exact:true}).click();await dialog.getByRole('heading',{name:'Lançar movimentação',exact:true}).waitFor();
 const skuPicker=dialog.getByLabel('SKU',{exact:true});await skuPicker.waitFor();await dialog.getByRole('button',{name:'Próximos SKUs',exact:true}).click();await skuPicker.selectOption('variant-21');
 setFailNextMovement(true);
 await dialog.getByRole('button',{name:'Confirmar movimentação',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(movementCreated(),true,'the first request committed before its response was lost');assert.equal(acceptedMovementCount(),1);
 await dialog.getByRole('button',{name:'Confirmar movimentação',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Recarregue'}).waitFor();assert.equal(movementKeys.length,2,'the retry reaches the API a second time');assert.equal(movementKeys[0],movementKeys[1],'a network retry reuses the same idempotency key');assert.equal(acceptedMovementCount(),1,'the retry does not create a second movement');
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Movimentações',exact:true}).click();await page.getByRole('heading',{name:'Movimentações',exact:true}).waitFor();
 await page.getByRole('button',{name:'Nova movimentação',exact:true}).click();await dialog.waitFor();await dialog.getByRole('heading',{name:'Lançar movimentação',exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Histórico de movimentações',exact:true}).click();await page.getByRole('heading',{name:'Histórico de movimentações',exact:true}).waitFor();await page.getByText('Nenhuma movimentação registrada',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('heading',{name:'Configurações de estoque',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByLabel('Navegar entre telas',{exact:true}).selectOption('users');await page.getByRole('heading',{name:'Usuários',exact:true}).waitFor();
 assert.ok(await page.locator('.inv-user-chip').isVisible());
 await page.locator('.inv-topbar-right').getByRole('button',{name:'Sair',exact:true}).click();await page.getByRole('heading',{name:'Entrar no FaseMarketplace'}).waitFor();await context.close();
 const regular=await contextFor({...admin,role:'user'});await regular.page.getByRole('button',{name:'Estoque físico',exact:true}).waitFor();await regular.page.getByRole('heading',{name:'Estoque físico',exact:true}).waitFor();assert.equal(await regular.page.getByLabel(/Definir mínimo/).count(),0,'regular users cannot edit per-SKU minimums');await regular.page.getByRole('button',{name:'Usuários',exact:true}).click();await regular.page.locator('.access-password-settings summary').waitFor();assert.equal(await regular.page.getByRole('button',{name:'Cadastrar usuário',exact:true}).count(),0);await regular.context.close();
 const pending=await contextFor({...admin,mustChangePassword:true});await pending.page.getByRole('heading',{name:'Troque sua senha provisória'}).waitFor();assert.equal(await pending.page.locator('.inv-app').count(),0);await pending.context.close();
 assert.deepEqual(errors,[]);console.log('PASS workspace navigation, no mocks, users, permissions, movement SKU pagination/retry idempotency, modal conflict/draft/focus/Escape and mobile');
}finally{await browser.close();}
