import PDFExposer from '@hideo54/pdf-exposer';
import axios from 'axios';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';
import { Message } from '@slack/events-api';
dotenv.config();

const pdfExposer = new PDFExposer();

const generateBlocks = async (fileURL: string, password?: string) => {
    const token = process.env.SLACK_BOT_TOKEN;
    const res = await axios.get(fileURL, {
        responseType: 'arraybuffer',
        headers: { Authorization: `Bearer ${token}`},
    });
    await fs.writeFile('./tmp.pdf', Buffer.from(res.data), 'binary');
    await pdfExposer.init('./tmp.pdf', password);
    const blocks = pdfExposer.generateSlackBlocks({
        emphasizesInvisibleTexts: true,
    });
    return blocks;
};

export default async (clients: Clients, tools: Tools) => {
    const webClient = clients.webClient;
    const slackEvents = clients.slackEvents;

    // @ts-ignore
    slackEvents.on('message', async (data: Message) => {
        const { channel, thread_ts, text } = data;
        if (!thread_ts) return;
        const args = text.split(' ');
        if (args[0] === '@fill') {
            const { messages } = await webClient.conversations.history({
                channel: channel,
                oldest: thread_ts,
                latest: thread_ts,
                inclusive: true,
            });
            // @ts-ignore
            const files = messages[0].files;
            if (!files) return;
            const file = files[0];
            if (file.mimetype !== 'application/pdf') return;
            const url = file.url_private_download;
            tools.logger.info(`Downloadable file specified: ${url}`);
            try {
                const blocks = await generateBlocks(url, args[1]);
                const headBlock = {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '穴埋めに成功したよ〜',
                    },
                };
                await webClient.chat.postMessage({
                    channel, thread_ts,
                    text: '穴埋めに成功したよ〜',
                    username: 'スライド穴埋めくん',
                    icon_emoji: ':pencil2:',
                    blocks: [ headBlock, ...blocks ],
                });
            } catch (error) {
                await webClient.chat.postMessage({
                    channel, thread_ts,
                    text: `失敗したよ:cry: ${JSON.stringify(error)}`,
                    username: 'スライド穴埋めくん',
                    icon_emoji: ':pencil2:',
                });
            }
        }
    });
};