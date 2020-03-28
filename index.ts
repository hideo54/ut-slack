import { WebClient } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';
import * as dotenv from 'dotenv';
dotenv.config();
import * as winston from 'winston';
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
];

const token = process.env.SLACK_BOT_TOKEN;

// Clients
const rtmClient = new RTMClient(token);
const webClient = new WebClient(token);

(async () => {
    // Tools
    const channels = (await webClient.channels.list()).channels as Channel[];
    const channelIDDetector = (name: string) => channels.filter(channel => channel.name === name )[0].id;
    const cacheName = `${__dirname}/cache.json`;

    await Promise.all(plugins.map(async plugin => {
        await plugin.default(
            {webClient, rtmClient},
            {channelIDDetector, cacheName, logger});
    }));
})();

rtmClient.on('authenticated', data => {
    logger.info('Logged in');
});

rtmClient.start()
    .then(result => logger.info('Started RTM Client'))
    .catch(err => logger.error(`Failed to start RTM Client: ${err}`));