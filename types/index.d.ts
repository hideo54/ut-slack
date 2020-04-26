import { WebClient, WebAPICallResult } from '@slack/web-api';
import SlackEventAdapter from '@slack/events-api';
import winston from 'winston';

declare global {
    interface Clients {
        webClient: WebClient;
        slackEvents: typeof SlackEventAdapter;
    }

    interface Tools {
        channelIDDetector: (name: string) => string;
        cacheName: string;
        logger: winston.Logger;
    }
}

declare module '@slack/events-api' {
    export interface PostMessageCallResult extends WebAPICallResult {
        channel: string;
        ts: string;
    }
    // https://api.slack.com/events/channel_created
    export interface ChannelCreated {
        type: 'channel_created';
        channel: {
            id: string;
            name: string;
            created: number;
            creator: string;
        };
    }
    // https://api.slack.com/events/emoji_changed
    export interface EmojiAdded {
        type: 'emoji_changed';
        subtype: 'add';
        name: string;
        value: string;
        event_ts: string;
    }
    export interface EmojiRemoved {
        type: 'emoji_removed';
        subtype: 'remove';
        names:string[];
        event_ts: string;
    }
    export interface Message {
        type: 'message';
        channel: string;
        user: string;
        text: string;
        ts: string; // Numeric
        thread_ts?: string;
    }
    export default class  {
        on(event: 'emoji_changed', callback: (data: EmojiAdded | EmojiRemoved) => void): void;
    }
}