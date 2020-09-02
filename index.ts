import { WebClient } from '@slack/web-api';
import { createEventAdapter } from '@slack/events-api';
import dotenv from 'dotenv';
dotenv.config();
import winston from 'winston';
const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.prettyPrint()
            ),
        }),
    ],
});

interface Channel {
    id: string;
    name: string;
}

const plugins = [
    require('./emoji-notifier'),
    require('./channel-notifier'),
    require('./kanaiWatcher'),
    require('./kyomuWatcher'),
    // require('./onlineLectureInfoWatcher'),
    // require('./slideFiller'),
];

// Clients
const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET!);

(async () => {
    // Tools
    const channels = (await webClient.channels.list()).channels as Channel[];
    const channelIDDetector = (name: string) => channels.filter(channel => channel.name === name )[0].id;
    const cacheName = `${__dirname}/cache.json`;

    await Promise.all(plugins.map(async plugin => {
        await plugin.default(
            {webClient, slackEvents},
            {channelIDDetector, cacheName, logger});
    }));
})();

slackEvents.on('error', console.error);
const port = Number(process.env.SLACK_EVENTS_SERVER_PORT) || 3000;
slackEvents.start(port).then(() => { console.log(`server listening on port ${port}`) });