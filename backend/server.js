const express=require("express");
const cors=require("cors");
const rateLimit=require("express-rate-limit");
const mongoose=require("mongoose");
const fs=require("fs");
const crypto=require("crypto");

const app=express();

const PORT=process.env.PORT||3000;
const MONGO_URL=process.env.MONGO_URL;
const ADMIN_ID=String(process.env.TELEGRAM_ADMIN_ID||"");

app.use(cors({
origin:true,
methods:["GET","POST","PATCH","DELETE","OPTIONS"]
}));

app.use(express.json({limit:"100kb"}));

app.use(rateLimit({
windowMs:60000,
max:120,
standardHeaders:true,
legacyHeaders:false
}));

// ============================================================
// MONGODB
// ============================================================

if(!MONGO_URL){
console.error("MONGO_URL is missing");
}else{
mongoose.connect(MONGO_URL)
.then(()=>console.log("MongoDB connected"))
.catch(e=>console.error("MongoDB error:",e.message));
}

// ============================================================
// MODELS
// ============================================================

const User=mongoose.model("User",new mongoose.Schema({
robloxId:{type:Number,index:true,unique:true},
username:{type:String,index:true},
avatar:String,
balance:{type:Number,default:0},
inventory:[{
uid:{type:String,required:true},
name:String,
value:{type:Number,default:0},
image:String
}],
stats:{
wagered:{type:Number,default:0},
profit:{type:Number,default:0}
},
createdAt:{type:Date,default:Date.now}
}));

const Chat=mongoose.model("Chat",new mongoose.Schema({
robloxId:Number,
username:String,
avatar:String,
text:String,
createdAt:{type:Date,default:Date.now,index:true}
}));

const Coinflip=mongoose.model("Coinflip",new mongoose.Schema({
ownerId:Number,
ownerUsername:String,
petUid:String,
petName:String,
value:Number,
side:String,
status:{
type:String,
default:"open"
},
joinerId:Number,
joinerUsername:String,
winnerId:Number,
createdAt:{type:Date,default:Date.now}
}));

const Settings=mongoose.model("Settings",new mongoose.Schema({
siteOnline:{type:Boolean,default:true},
announcement:{type:String,default:""}
}));

// ============================================================
// SIGNED AUTH
// ============================================================

const AUTH_SECRET=
process.env.AUTH_SECRET||
crypto.createHash("sha256")
.update(MONGO_URL||"admflip-secret")
.digest("hex");

function signToken(userId){

const payload={
id:Number(userId),
exp:Date.now()+1000*60*60*24*30
};

const body=
Buffer.from(JSON.stringify(payload))
.toString("base64url");

const sig=
crypto.createHmac("sha256",AUTH_SECRET)
.update(body)
.digest("base64url");

return body+"."+sig;
}

function auth(req,res,next){

const header=req.headers.authorization||"";

if(!header.startsWith("Bearer ")){
return res.status(401).json({
success:false,
message:"Authentication required"
});
}

const token=header.slice(7);
const parts=token.split(".");

if(parts.length!==2){
return res.status(401).json({
success:false,
message:"Invalid session"
});
}

const [body,sig]=parts;

const expected=
crypto.createHmac("sha256",AUTH_SECRET)
.update(body)
.digest("base64url");

if(
!crypto.timingSafeEqual(
Buffer.from(sig),
Buffer.from(expected)
)
){
return res.status(401).json({
success:false,
message:"Invalid session"
});
}

try{

const payload=
JSON.parse(
Buffer.from(body,"base64url").toString()
);

if(payload.exp<Date.now()){
return res.status(401).json({
success:false,
message:"Session expired"
});
}

req.userId=Number(payload.id);

next();

}catch(e){

return res.status(401).json({
success:false,
message:"Invalid session"
});
}
}

// ============================================================
// PET VALUES
// ============================================================

function loadPets(){

try{

const text=
fs.readFileSync("./values.txt","utf8");

const lines=text
.split(/\r?\n/)
.map(x=>x.trim())
.filter(Boolean);

const result=[];

for(let i=0;i<lines.length;i+=2){

const name=lines[i];
let value=lines[i+1];

if(!name||!value)continue;

value=String(value)
.replace(/[$,]/g,"")
.trim();

result.push({
name,
value:Number(value)||0
});
}

console.log("Loaded pets:",result.length);

return result;

}catch(e){

console.error("Pet loading error:",e.message);

return [];
}

}

let pets=loadPets();

function findPet(name){

return pets.find(
p=>p.name.toLowerCase()===String(name).toLowerCase()
);
}

// ============================================================
// HOME
// ============================================================

app.get("/",(req,res)=>{
res.send("ADMFLIP backend is online");
});

// ============================================================
// STATUS
// ============================================================

app.get("/status",async(req,res)=>{

try{

let settings=await Settings.findOne();

if(!settings){
settings=await Settings.create({});
}

res.json({
online:settings.siteOnline,
announcement:settings.announcement
});

}catch(e){

res.json({
online:true,
announcement:""
});
}
});

// ============================================================
// PETS
// ============================================================

app.get("/pets",(req,res)=>{

res.json({
success:true,
pets
});

});

// ============================================================
// ROBLOX USER
// ============================================================

app.get("/user/:username",async(req,res)=>{

try{

const username=req.params.username;

const r=await fetch(
"https://users.roblox.com/v1/usernames/users",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
usernames:[username],
excludeBannedUsers:true
})
}
);

const data=await r.json();

if(!data.data||!data.data.length){

return res.json({
success:false,
message:"Roblox username not found"
});
}

const robloxUser=data.data[0];

const avatarResponse=await fetch(
`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png`
);

const avatarData=await avatarResponse.json();

res.json({
success:true,
user:{
id:robloxUser.id,
robloxId:robloxUser.id,
username:robloxUser.name,
avatar:avatarData.data?.[0]?.imageUrl||"roblox.png"
}
});

}catch(e){

console.error(e);

res.status(500).json({
success:false,
message:"Server error"
});
}
});

// ============================================================
// PHRASE
// ============================================================

function generatePhrase(){

const words=[
"BlueTiger",
"FastCloud",
"LuckyWave",
"SilverMoon",
"GoldenLeaf"
];

return words[
Math.floor(Math.random()*words.length)
]+"-"+Math.floor(1000+Math.random()*9000);
}

app.get("/create",(req,res)=>{
res.json({
phrase:generatePhrase()
});
});

// ============================================================
// VERIFY
// ============================================================

app.post("/check",async(req,res)=>{

try{

const username=
String(req.body.username||"").trim();

const phrase=
String(req.body.phrase||"").trim();

if(!username||!phrase){

return res.status(400).json({
success:false,
message:"Missing username or phrase"
});
}

const r=await fetch(
"https://users.roblox.com/v1/usernames/users",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
usernames:[username],
excludeBannedUsers:true
})
}
);

const data=await r.json();

if(!data.data?.length){

return res.json({
success:false,
message:"Roblox username not found"
});
}

const id=data.data[0].id;

const profileResponse=await fetch(
`https://users.roblox.com/v1/users/${id}`
);

const profile=await profileResponse.json();

if(
!profile.description||
!profile.description.includes(phrase)
){

return res.json({
success:false,
message:"Verification phrase not found in bio"
});
}

let user=await User.findOne({
robloxId:id
});

if(!user){

user=await User.create({
robloxId:id,
username:profile.name
});

}else{

user.username=profile.name;
await user.save();
}

res.json({
success:true,
username:profile.name,
id,
token:signToken(id)
});

}catch(e){

console.error("Verification:",e);

res.status(500).json({
success:false,
message:"Verification failed"
});
}
});

// ============================================================
// INVENTORY
// ============================================================

app.get("/inventory/:id",auth,async(req,res)=>{

if(Number(req.params.id)!==req.userId){

return res.status(403).json({
success:false,
message:"Not your inventory"
});
}

const user=await User.findOne({
robloxId:req.userId
});

if(!user){

return res.status(404).json({
success:false,
message:"User not found"
});
}

res.json({
success:true,
inventory:user.inventory
});
});

// ============================================================
// CHAT
// ============================================================

app.get("/chat",async(req,res)=>{

const messages=await Chat.find()
.sort({createdAt:1})
.limit(100)
.lean();

res.json({
success:true,
messages
});
});

app.post("/chat",auth,async(req,res)=>{

const text=String(req.body.text||"").trim();

if(!text){

return res.status(400).json({
success:false,
message:"Message is empty"
});
}

if(text.length>300){

return res.status(400).json({
success:false,
message:"Message too long"
});
}

// Server-side link protection.
if(
/https?:\/\/|www\.|discord\.gg|discord\.com\/invite|t\.me\/|bit\.ly\//i
.test(text)
){

return res.status(400).json({
success:false,
message:"Links are not allowed"
});
}

const user=await User.findOne({
robloxId:req.userId
});

if(!user){

return res.status(404).json({
success:false,
message:"User not found"
});
}

await Chat.create({
robloxId:user.robloxId,
username:user.username,
avatar:user.avatar,
text
});

res.json({
success:true
});
});

// ============================================================
// COINFLIPS
// ============================================================

app.get("/coinflips",async(req,res)=>{

const flips=await Coinflip.find({
status:"open"
})
.sort({createdAt:-1})
.limit(100)
.lean();

res.json({
success:true,
coinflips:flips
});
});

app.post("/coinflips",auth,async(req,res)=>{

const petId=String(req.body.petId||"");
const side=String(req.body.side||"");

if(!["Heads","Tails"].includes(side)){

return res.status(400).json({
success:false,
message:"Invalid side"
});
}

const session=await mongoose.startSession();

try{

let created;

await session.withTransaction(async()=>{

const user=await User.findOne({
robloxId:req.userId
}).session(session);

if(!user)throw new Error("User not found");

const index=user.inventory.findIndex(
p=>String(p._id)===petId||
p.uid===petId
);

if(index===-1){
throw new Error("Pet is not in your inventory");
}

const pet=user.inventory[index];

const uid=pet.uid;

user.inventory.splice(index,1);

await user.save({
session
});

created=await Coinflip.create([{
ownerId:user.robloxId,
ownerUsername:user.username,
petUid:uid,
petName:pet.name,
value:pet.value,
side
}],{session});

});

res.json({
success:true,
coinflip:created[0]
});

}catch(e){

res.status(400).json({
success:false,
message:e.message
});

}finally{

await session.endSession();
}
});

app.post("/coinflips/:id/join",auth,async(req,res)=>{

const session=await mongoose.startSession();

try{

let message="";

await session.withTransaction(async()=>{

const flip=await Coinflip.findOneAndUpdate(
{
_id:req.params.id,
status:"open",
ownerId:{$ne:req.userId}
},
{
$set:{
status:"matched",
joinerId:req.userId
}
},
{
new:true,
session
}
);

if(!flip){
throw new Error("Coinflip is no longer available");
}

const user=await User.findOne({
robloxId:req.userId
}).session(session);

if(!user){
throw new Error("User not found");
}

if(user.inventory.length===0){
throw new Error("You have no pets to wager");
}

// The joiner is not automatically charged here.
// A production coinflip should escrow the selected
// joiner pet and resolve both wagers atomically.

message="Coinflip joined. Resolution system ready.";

});

res.json({
success:true,
message
});

}catch(e){

res.status(400).json({
success:false,
message:e.message
});

}finally{

await session.endSession();
}
});

app.get("/coinflips/history",auth,async(req,res)=>{

const flips=await Coinflip.find({
$or:[
{ownerId:req.userId},
{joinerId:req.userId}
]
})
.sort({createdAt:-1})
.limit(100)
.lean();

res.json({
success:true,
coinflips:flips
});
});

// ============================================================
// ADMIN HELPERS
// ============================================================

function isAdminTelegram(id){

return ADMIN_ID &&
String(id)===ADMIN_ID;
}

async function adminAddPet(
robloxId,
name,
value,
image=""
){

const user=await User.findOne({
robloxId:Number(robloxId)
});

if(!user)throw new Error("User not found");

const pet=findPet(name);

const finalValue=
Number(value)||
pet?.value||
0;

user.inventory.push({
uid:crypto.randomUUID(),
name,
value:finalValue,
image
});

await user.save();

return user;
}

async function adminRemovePet(
robloxId,
uid
){

const user=await User.findOne({
robloxId:Number(robloxId)
});

if(!user)throw new Error("User not found");

const index=user.inventory.findIndex(
p=>p.uid===uid||
String(p._id)===uid
);

if(index===-1){
throw new Error("Pet not found");
}

user.inventory.splice(index,1);

await user.save();

return user;
}

async function adminTransferPet(
from,
to,
uid
){

const session=await mongoose.startSession();

try{

await session.withTransaction(async()=>{

const sender=await User.findOne({
robloxId:Number(from)
}).session(session);

const receiver=await User.findOne({
robloxId:Number(to)
}).session(session);

if(!sender)throw new Error("Sender not found");
if(!receiver)throw new Error("Receiver not found");

const index=sender.inventory.findIndex(
p=>p.uid===uid||
String(p._id)===uid
);

if(index===-1){
throw new Error("Pet not found");
}

const pet=sender.inventory[index];

sender.inventory.splice(index,1);

receiver.inventory.push({
uid:crypto.randomUUID(),
name:pet.name,
value:pet.value,
image:pet.image
});

await sender.save({session});
await receiver.save({session});

});

}finally{

await session.endSession();
}
}

// ============================================================
// TELEGRAM ADMIN BOT
// ============================================================

if(process.env.TELEGRAM_TOKEN){

try{

const TelegramBot=require("node-telegram-bot-api");

const bot=new TelegramBot(
process.env.TELEGRAM_TOKEN,
{polling:true}
);

console.log("Telegram bot started");

bot.onText(/^\/help$/,msg=>{

if(!isAdminTelegram(msg.from.id))return;

bot.sendMessage(
msg.chat.id,
[
"ADMFLIP ADMIN",
"",
"/status",
"/balance ID",
"/addbalance ID AMOUNT",
"/removebalance ID AMOUNT",
"/addpet ID PET [VALUE]",
"/removepet ID UID",
"/transfer FROM TO UID",
"/shutdown",
"/startsite"
].join("\n")
);
});

bot.onText(/^\/status$/,async msg=>{

if(!isAdminTelegram(msg.from.id))return;

const settings=
await Settings.findOne()||
await Settings.create({});

bot.sendMessage(
msg.chat.id,
`Site: ${settings.siteOnline?"ONLINE":"OFFLINE"}`
);
});

bot.onText(/^\/balance (\d+)$/,async(msg,m)=>{

if(!isAdminTelegram(msg.from.id))return;

const user=await User.findOne({
robloxId:Number(m[1])
});

if(!user){
return bot.sendMessage(
msg.chat.id,
"User not found"
);
}

bot.sendMessage(
msg.chat.id,
`${user.username}: ${user.balance}`
);
});

bot.onText(
/^\/addbalance (\d+) (-?\d+(?:\.\d+)?)$/,
async(msg,m)=>{

if(!isAdminTelegram(msg.from.id))return;

const user=await User.findOne({
robloxId:Number(m[1])
});

if(!user){
return bot.sendMessage(
msg.chat.id,
"User not found"
);
}

user.balance+=Number(m[2]);

await user.save();

bot.sendMessage(
msg.chat.id,
"Balance updated."
);
});

bot.onText(
/^\/removebalance (\d+) (\d+(?:\.\d+)?)$/,
async(msg,m)=>{

if(!isAdminTelegram(msg.from.id))return;

const user=await User.findOne({
robloxId:Number(m[1])
});

if(!user){
return bot.sendMessage(
msg.chat.id,
"User not found"
);
}

const amount=Number(m[2]);

if(user.balance<amount){

return bot.sendMessage(
msg.chat.id,
"Insufficient balance."
);
}

user.balance-=amount;

await user.save();

bot.sendMessage(
msg.chat.id,
"Balance removed."
);
});

bot.onText(
/^\/addpet (\d+) (.+?)(?: (\d+(?:\.\d+)?))?$/,
async(msg,m)=>{

if(!isAdminTelegram(msg.from.id))return;

try{

await adminAddPet(
Number(m[1]),
m[2],
Number(m[3]||0)
);

bot.sendMessage(
msg.chat.id,
"Pet added."
);

}catch(e){

bot.sendMessage(
msg.chat.id,
e.message
);
}
});

bot.onText(
/^\/removepet (\d+) (\S+)$/,
async(msg,m)=>{

if(!isAdminTelegram(msg.from.id))return;

try{

await adminRemovePet(
Number(m[1]),
m[2]
);

bot.sendMessage(
msg.chat.id,
"Pet removed."
);

}catch(e){

bot.sendMessage(
msg.chat.id,
e.message
);
}
});

bot.onText(
/^\/transfer (\d+) (\d+) (\S+)$/,
async(msg,m)=>{

if(!isAdminTelegram(msg.from.id))return;

try{

await adminTransferPet(
Number(m[1]),
Number(m[2]),
m[3]
);

bot.sendMessage(
msg.chat.id,
"Pet transferred."
);

}catch(e){

bot.sendMessage(
msg.chat.id,
e.message
);
}
});

bot.onText(/^\/shutdown$/,async msg=>{

if(!isAdminTelegram(msg.from.id))return;

const settings=
await Settings.findOne()||
await Settings.create({});

settings.siteOnline=false;

await settings.save();

bot.sendMessage(
msg.chat.id,
"ADMFLIP is now offline."
);
});

bot.onText(/^\/startsite$/,async msg=>{

if(!isAdminTelegram(msg.from.id))return;

const settings=
await Settings.findOne()||
await Settings.create({});

settings.siteOnline=true;

await settings.save();

bot.sendMessage(
msg.chat.id,
"ADMFLIP is online."
);
});

bot.on("polling_error",error=>{
console.error(
"Telegram polling:",
error.message
);
});

}catch(e){

console.error(
"Telegram bot could not start:",
e.message
);
}

}

// ============================================================
// START
// ============================================================

app.listen(PORT,"0.0.0.0",()=>{
console.log(
`ADMFLIP backend running on port ${PORT}`
);
});
