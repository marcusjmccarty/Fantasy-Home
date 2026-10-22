// Share only in-flight public reads. Completed values and TTLs belong to the caller.
export function createReadCoalescer(limit=32){
 if(!Number.isInteger(limit)||limit<1)throw new RangeError('Invalid in-flight limit');
 const pending=new Map();
 return (key,load)=>{
  if(pending.has(key))return pending.get(key);
  const request=Promise.resolve().then(load);
  // At capacity, preserve request behavior without retaining another entry.
  if(pending.size>=limit)return request;
  pending.set(key,request);
  const release=()=>{if(pending.get(key)===request)pending.delete(key);};
  request.then(release,release);
  return request;
 };
}
