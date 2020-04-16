import { WebClient } from '@slack/web-api';
import SlackEventAdapter from '@slack/events-api';
import winston from 'winston';

interface Clients {
    webClient: WebClient;
    slackEvents: typeof SlackEventAdapter;
}

interface Tools {
    channelIDDetector: (name: string) => string;
    cacheName: string;
    logger: winston.Logger;
}