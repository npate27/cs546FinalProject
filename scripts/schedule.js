const cron = require('node-cron');
const nodemailer = require('nodemailer');
const data = require('../data');
const usersData = data.users;
const itemsData = data.items;
const productsData = data.products;
const sgTransport = require('nodemailer-sendgrid-transport');

let dateToday = new Date().getDate()
let dateTomorrow = dateToday + 1;
let dateWeekAway = dateToday + 7;

/*Go through all items of a given user and organize items
 *based on their expiry date 
 */
var calculateExpireItems = function(listItems) {
    let weekExpire = [];
    let todayExpire = [];
    let tomorrowExpire = [];
    let alreadyExpire = [];

    listItems.forEach(function(item) {
        let expiration = item.date_of_expiration.split("-");
        expiration = new Date(expiration[2], expiration[0] - 1, expiration[1]);
        let expirationDate = expiration.getDate();
        if (expirationDate == dateToday) {
            todayExpire.push(item);
        } else if (expirationDate == dateTomorrow) {
            tomorrowExpire.push(item);
        } else if (expirationDate < dateWeekAway && expirationDate > dateToday && expirationDate + 1 != dateTomorrow) {
            weekExpire.push(item);
        } else if (expirationDate < dateToday) {
            alreadyExpire.push(item);
            itemsData.removeItem(item._id)
        }

    });
    return [todayExpire, tomorrowExpire, weekExpire, alreadyExpire];
};

var options = {
    auth: {
        api_key: '' //Insert API Key
    }
}

var transporter = nodemailer.createTransport(sgTransport(options));

/*Generate and send email formatted properly in html
 */
var generateEmail = function(todayExpire, tomorrowExpire, weekExpire, alreadyExpire, toEmail) {

    let todayExpireString = todayExpire.map(function(a) { return a.nickname; }).join(', ');
    let tomorrowExpireString = tomorrowExpire.map(function(a) { return a.nickname; }).join(', ');
    let weekExpireString = weekExpire.map(function(a) { return a.nickname; }).join(', ');
    let alreadyExpireString = alreadyExpire.map(function(a) { return a.nickname; }).join(', ');

    todayExpireString = !!todayExpireString ? todayExpireString : "None";
    tomorrowExpireString = !!tomorrowExpireString ? tomorrowExpireString : "None";
    weekExpireString = !!weekExpireString ? weekExpireString : "None";
    alreadyExpireString = !!alreadyExpireString ? alreadyExpireString : "None";

    todayExpireString = '<p>Expires today: ' + todayExpireString.toString() + '</p>';
    tomorrowExpireString = '<p>Expires tomorrow: ' + tomorrowExpireString.toString() + '</p>';
    weekExpireString = '<p>Expires within 7 days: ' + weekExpireString.toString() + '</p>';
    alreadyExpireString = '<p> The following items just expired! Please remove them from your fridge/pantry: ' + alreadyExpireString.toString() + '</p>';

    let reportString = '<p> Here is your daily update from Spoiler Alert: </p>' + todayExpireString + tomorrowExpireString + weekExpireString + alreadyExpireString;

    let mailOptions = {
        from: '"Spoiler Alert Team" <spoileralert@cs546.gomeznj.com>',
        to: toEmail,
        subject: "Your daily report",
        html: reportString
    };
    transporter.sendMail(mailOptions);
};

module.exports = {
    /*Goes through all users and sends email report
     *every midnight
     */
    scheduleEmail: function() {
        //Every midnight it will run
        cron.schedule('0 0 0 * * *', function() {
            var count = 0;
            return usersData.getAllUsers().then((allUsers) => {
                count = Object.keys(allUsers).length;
                var sequence = Promise.resolve();
                allUsers.forEach(function(currUser) {
                    sequence = sequence.then(function() {
                        return itemsData.getAllItems(currUser._id)
                    }).then(function(itemList) {
                        if (count > 0) {
                            resultItems = calculateExpireItems(itemList);
                            generateEmail(resultItems[0], resultItems[1], resultItems[2], resultItems[3], currUser.profile.email);
                            count--;
                        }
                    });
                });
                console.log("Sent email reports to all users");
            });
        });
    }
}
