const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");


const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;



const Settings = mongoose.model(
    "Settings"
);



if(!TOKEN){

    console.log("Telegram token missing");

}
else{


const bot = new TelegramBot(
    TOKEN,
    {
        polling:true
    }
);



function isAdmin(msg){

    return String(msg.from.id) === String(ADMIN_ID);

}





// ======================
// HELP
// ======================


bot.onText(/\/help/, (msg)=>{


if(!isAdmin(msg)) return;


bot.sendMessage(

msg.chat.id,

`
ADMFLIP ADMIN COMMANDS

/help
Show commands

/shutdown
Turn site offline

/startsite
Turn site online

/announce text
Show announcement

/clearannounce
Remove announcement

/stats
Show basic stats
`

);


});








// ======================
// SHUTDOWN
// ======================


bot.onText(/\/shutdown/, async(msg)=>{


if(!isAdmin(msg)) return;



await Settings.findOneAndUpdate(

{},

{

siteOnline:false,

announcement:
"ADMFLIP is currently under maintenance."

},

{

upsert:true

}

);



bot.sendMessage(

msg.chat.id,

"🔴 Site shutdown activated"

);


});







// ======================
// START SITE
// ======================


bot.onText(/\/startsite/, async(msg)=>{


if(!isAdmin(msg)) return;



await Settings.findOneAndUpdate(

{},

{

siteOnline:true,

announcement:""

},

{

upsert:true

}

);



bot.sendMessage(

msg.chat.id,

"🟢 Site is online"

);


});








// ======================
// ANNOUNCEMENT
// ======================


bot.onText(
/\/announce (.+)/,
async(msg,match)=>{


if(!isAdmin(msg)) return;



const text = match[1];



await Settings.findOneAndUpdate(

{},

{

announcement:text

},

{

upsert:true

}

);



bot.sendMessage(

msg.chat.id,

"📢 Announcement sent"

);


});







// ======================
// CLEAR ANNOUNCEMENT
// ======================


bot.onText(/\/clearannounce/,async(msg)=>{


if(!isAdmin(msg)) return;



await Settings.findOneAndUpdate(

{},

{

announcement:""

}

);



bot.sendMessage(

msg.chat.id,

"Announcement removed"

);


});







console.log(
"Telegram bot started"
);


}
