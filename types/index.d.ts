import { WebClient } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';
import winston from 'winston';

interface Clients {
    webClient: WebClient;
    rtmClient: RTMClient;
}

interface Tools {
    channelIDDetector: (name: string) => string;
    cacheName: string;
    logger: winston.Logger;
}