// La cryptographie s'exécute uniquement dans le navigateur. Aucun appel réseau.
export const NETWORK = 'mithimbochain-local-v1';
const encoder = new TextEncoder();
const ITERATIONS = 310000;
const FIELDS = ['version','network','name','address','publicKey','kdf','salt','iv','ciphertext'];
const hex = data => Array.from(new Uint8Array(data), b => b.toString(16).padStart(2,'0')).join('');
function unhex(value, bytes) {
  if (typeof value !== 'string' || value.length !== bytes * 2 || !/^[0-9a-f]+$/.test(value)) throw new Error('Fichier de portefeuille invalide.');
  return Uint8Array.from(value.match(/../g), b => parseInt(b,16));
}
export function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Un entier est requis.');
  if (value !== null && !['string','number','boolean'].includes(typeof value)) throw new Error('Donnée invalide.');
  return JSON.stringify(value);
}
async function hash(bytes) {return hex(await crypto.subtle.digest('SHA-256', bytes));}
async function address(publicKey) {return 'mtc_'+await hash(unhex(publicKey,32));}
function metadata(vault) {const {ciphertext,...rest}=vault;return encoder.encode(canonical(rest));}
async function passwordKey(password,salt) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Choisissez un mot de passe de 12 à 256 caractères.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function validateVault(vault) {
  if (!vault || typeof vault !== 'object' || Array.isArray(vault) || Object.keys(vault).sort().join() !== FIELDS.slice().sort().join()
      || vault.version!==1 || vault.network!==NETWORK || vault.kdf!=='PBKDF2-SHA256-310000'
      || typeof vault.name!=='string' || vault.name.trim().length<1 || vault.name.length>60
      || !/^mtc_[0-9a-f]{64}$/.test(vault.address)) throw new Error('Fichier de portefeuille incompatible ou invalide.');
  unhex(vault.publicKey,32);unhex(vault.salt,16);unhex(vault.iv,12);
  if (typeof vault.ciphertext!=='string' || vault.ciphertext.length<64 || vault.ciphertext.length>4096 || vault.ciphertext.length%2) throw new Error('Fichier de portefeuille invalide.');
  unhex(vault.ciphertext,vault.ciphertext.length/2);
  return vault;
}
export async function createWallet(name,password) {
  if (typeof name!=='string' || !name.trim() || name.trim().length>60) throw new Error('Donnez un nom au portefeuille (60 caractères maximum).');
  if (!crypto?.subtle) throw new Error('Ouvrez le site sur localhost avec un navigateur récent.');
  let pair;
  try {pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);}
  catch {throw new Error('Ce navigateur ne prend pas en charge Ed25519. Utilisez un navigateur récent.');}
  const publicKey=hex(await crypto.subtle.exportKey('raw',pair.publicKey));
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const vault={version:1,network:NETWORK,name:name.trim(),address:await address(publicKey),publicKey,kdf:'PBKDF2-SHA256-310000',salt:hex(salt),iv:hex(iv)};
  const key=await passwordKey(password,salt);
  const raw=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));
  try {
    vault.ciphertext=hex(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:metadata(vault)},key,raw));
  } finally {raw.fill(0);}
  return validateVault(vault);
}
export async function unlockWallet(vault,password) {
  validateVault(vault);
  const key=await passwordKey(password,unhex(vault.salt,16));
  let raw;
  try {
    raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(vault.iv,12),additionalData:metadata(vault)},key,unhex(vault.ciphertext,vault.ciphertext.length/2)));
    const temporary=await crypto.subtle.importKey('pkcs8',raw,'Ed25519',true,['sign']);
    const jwk=await crypto.subtle.exportKey('jwk',temporary);
    const publicBytes=Uint8Array.from(atob(jwk.x.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    if (hex(publicBytes)!==vault.publicKey || await address(vault.publicKey)!==vault.address) throw new Error();
    return await crypto.subtle.importKey('pkcs8',raw,'Ed25519',false,['sign']);
  } catch {throw new Error('Mot de passe incorrect ou sauvegarde endommagée.');}
  finally {raw?.fill(0);}
}
export async function signTransfer(vault,key,recipient,amount,nonce) {
  validateVault(vault);
  if (!/^mtc_[0-9a-f]{64}$/.test(recipient) || recipient===vault.address) throw new Error('Choisissez une autre adresse MTC valide.');
  if (!Number.isSafeInteger(amount) || amount<1 || amount>10000 || !Number.isSafeInteger(nonce) || nonce<1) throw new Error('Montant ou numéro de transaction invalide.');
  const tx={chain_id:NETWORK,kind:'transfer',sender:vault.address,recipient,amount,nonce,public_key:vault.publicKey};
  tx.signature=hex(await crypto.subtle.sign('Ed25519',key,encoder.encode(canonical(tx))));
  const publicKey=await crypto.subtle.importKey('raw',unhex(vault.publicKey,32),'Ed25519',false,['verify']);
  if (!await crypto.subtle.verify('Ed25519',publicKey,unhex(tx.signature,64),encoder.encode(canonical(Object.fromEntries(Object.entries(tx).filter(([k])=>k!=='signature')))))) throw new Error('Le portefeuille déverrouillé ne correspond pas à cette adresse.');
  tx.id=await hash(encoder.encode(canonical(tx)));
  return tx;
}
