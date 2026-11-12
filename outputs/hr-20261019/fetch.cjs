const fs = require('node:fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = getFirestore();
function plain(v) {
  if (v == null) return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)]));
  return v;
}
(async()=>{
  const collections = ['users','workplace_memberships','stores','offices','warehouses','custom_roles'];
  const snaps = await Promise.all(collections.map(c=>db.collection(c).get()));
  const data = Object.fromEntries(snaps.map((s,i)=>[collections[i],s.docs.map(d=>({...plain(d.data()),documentId:d.id}))]));
  const start = Date.parse('2026-07-01T00:00:00+07:00');
  const end = Date.parse('2026-10-20T00:00:00+07:00');
  const selected = data.users.filter(u=>Date.parse(u.createdAt)>=start&&Date.parse(u.createdAt)<end);
  if(selected.some(u=>typeof u.isActive!=='boolean')) throw new Error('Missing status');
  const omitted=['fcmToken','fcmTokens','twoFactorSecret'];
  data.users=selected.map(u=>Object.fromEntries(Object.entries(u).filter(([k])=>!omitted.includes(k)))).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const ids = new Set(data.users.map(u=>u.uid||u.documentId));
  data.workplace_memberships=data.workplace_memberships.filter(m=>ids.has(m.userId));
  data.meta={start:'2026-07-01T00:00:00+07:00',endExclusive:'2026-10-20T00:00:00+07:00',timezone:'Asia/Ho_Chi_Minh',count:selected.length,active:selected.filter(x=>x.isActive).length,inactive:selected.filter(x=>!x.isActive).length,omitted};
  fs.writeFileSync(__dirname+'/source.json',JSON.stringify(data));
  console.log(JSON.stringify({...data.meta,memberships:data.workplace_memberships.length,fields:[...new Set(data.users.flatMap(Object.keys))]}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
