console.log("telegram.js loaded");


const TelegramBot = require("node-telegram-bot-api");


const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;


console.log(
    "Token exists:",
    !!TOKEN
);


console.log(
    "Admin ID:",
    ADMIN_ID
);



if (!TOKEN) {

    console.log(
        "NO TELEGRAM TOKEN"
    );

} else {


    const bot = new TelegramBot(
        TOKEN,
        {
            polling:true
        }
    );


    bot.onText(/\/start/, (msg)=>{


        if(
            String(msg.from.id) !== String(ADMIN_ID)
        ){

            bot.sendMessage(
                msg.chat.id,
                "No permission"
            );

            return;

        }


        bot.sendMessage(
            msg.chat.id,
            "ADMFLIP Admin Bot Online ✅"
        );


    });



    console.log(
        "Telegram bot started"
    );


}
