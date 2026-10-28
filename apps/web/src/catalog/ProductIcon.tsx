const customIcons:Record<string,string>={
  product_cap:'M3 15c0-5 3.7-9 9-9 4.7 0 7.7 3.4 8 8.1 1.9.3 3 1 3 1.9 0 1.4-2.5 2-5 2H5c-1.4 0-2-.8-2-2.1V15Zm0 0h17M12 6v9M5 18h13',
  product_shorts:'M5 4h14l1 7 2 8-6 1-4-7-4 7-6-1 2-8 1-7Zm0 3h14M12 7v6',
  product_socks:'M8 3h8v8c0 1 .5 1.7 1.4 2.2l2.1 1.2c2 1.1 2.1 3.9.3 5.2-1.1.8-2.5.9-3.7.4l-6-2.7C8.7 16.6 8 15.5 8 14V3Zm0 3h8M8 11h8',
};

export function ProductIcon({name,className='material-symbols-outlined'}:{name:string;className?:string}){
  const path=customIcons[name];
  return <span className={className} aria-hidden="true">{path?<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>:name}</span>;
}
