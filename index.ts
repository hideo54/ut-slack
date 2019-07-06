import { WebClient } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';
import * as dotenv from 'dotenv';
dotenv.config();

interface Channel {
    id: string,
    name: string,
}

const plugins = [
    require('./emoji-notifier'),
    require('./channel-notifier'),
    require('./kanaiWatcher'),
    require('./kyomuWatcher'),
];

(async () => {
    const token = process.env.SLACK_BOT_TOKEN;

    // Clients
    const rtmClient = new RTMClient(token);
    const webClient = new WebClient(token);

    rtmClient.start().catch(err => console.log(err));

    // Tools
    const channels = (await webClient.channels.list()).channels as Channel[];
    const channelIDDetector = name => {
        return channels.filter(channel => channel.name === name )[0].id;
    };
    const cacheName = `${__dirname}/cache.json`;

    await Promise.all(plugins.map(async plugin => {
        await plugin.default(
            {webClient, rtmClient},
            {channelIDDetector, cacheName});
    }));
})();