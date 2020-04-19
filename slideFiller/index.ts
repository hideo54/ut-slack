import PDFExposer from '@hideo54/pdf-exposer';
import axios from 'axios';
import { promises as fs } from 'fs';

const pdfExposer = new PDFExposer();

const generateBlocks = async (fileURL: string, password?: string) => {
    const res = await axios.get(fileURL, { responseType: 'arraybuffer' });
    await fs.writeFile('./tmp.pdf', Buffer.from(res.data), 'binary');
    await pdfExposer.init('./tmp.pdf', password);
    const blocks = pdfExposer.generateSlackBlocks({
        emphasizesInvisibleTexts: true,
    });
    return blocks;
};

export default async (clients, tools) => {
    const webClient = clients.webClient;
    const slackEvents = clients.slackEvents;

    slackEvents.on('message', async (data) => {
        const { channel, thread_ts, text } = data;
        if (!thread_ts) return;
        const args = text.split(' ');
        if (args === '@bot') {
            const { messages } = await webClient.conversations.history({
                channel: channel,
                oldest: thread_ts,
                latest: thread_ts,
                inclusive: true,
            });
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
                    text: `失敗したよ:cry: ${error}`,
                    username: 'スライド穴埋めくん',
                    icon_emoji: ':pencil2:',
                });
            }
        }
    });
};