
import fs from 'fs';
const DB_PATH = './db.json';

function readDB(){
  if(!fs.existsSync(DB_PATH)){
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], posts: [], nonces: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH,'utf-8'));
}
function writeDB(data){ fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

export function getUserByUsername(username){
  const db = readDB(); return db.users.find(u=>u.username===username);
}
export function getUserByAddress(address){
  const db = readDB(); return db.users.find(u=>u.address?.toLowerCase()===address?.toLowerCase());
}
export function createUser(user){
  const db = readDB(); db.users.push(user); writeDB(db); return user;
}
export function listPosts(topic=null){
  const db = readDB();
  return db.posts
    .filter(p=>!topic || p.topic===topic)
    .sort((a,b)=>b.createdAt - a.createdAt);
}
export function createPost(post){
  const db = readDB(); db.posts.push(post); writeDB(db); return post;
}
export function saveNonce(address, nonce){
  const db = readDB(); db.nonces[address.toLowerCase()] = nonce; writeDB(db);
}
export function popNonce(address){
  const db = readDB(); const key=address.toLowerCase(); const n = db.nonces[key]; delete db.nonces[key]; writeDB(db); return n;
}
