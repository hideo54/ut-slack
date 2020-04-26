import axios from 'axios';
import cheerio from 'cheerio';
import iconv from 'iconv-lite';
import fs from 'fs';
import diff from 'diff';
import schedule from 'node-schedule';
import { MessageAttachment } from '@slack/web-api';

const url = 'https://www.ms.u-tokyo.ac.jp/~mkanai/culc2/';

const patrol = async (cacheName: string) => {
    const source_SJIS = (await axios.get(url, {
        responseType: 'arraybuffer',
    })).data;
    const source = iconv.decode(source_SJIS, 'Shift_JIS');
    const body = cheerio.load(source, { decodeEntities: false })('body');
    const latestContent = {
        source: body.html(),
        text: body.text(),
    };
    const cache = JSON.parse(fs.readFileSync(cacheName, 'utf-8'));
    const cachedContent = cache.kanaiWatcher;
    const diffs = diff.diffTrimmedLines(cachedContent.text, latestContent.text).filter(diff => diff.added || diff.removed);
    cache.kanaiWatcher = latestContent;
    fs.writeFileSync(cacheName, JSON.stringify(cache));
    return diffs;
};

export default async (clients: Clients, tools: Tools) => {
    schedule.scheduleJob('*/10 * * * *', async () => {
        const diffs = await patrol(tools.cacheName);
        if (diffs.length > 0) {
            tools.logger.info('Got new diffs.');
            const channel = tools.channelIDDetector('微分積分学');
            const attachments: MessageAttachment[] = [];
            for (const diff of diffs) {
                diff.value = diff.value.replace(/\n/g, '');
                if (diff.value === '') continue;
                if (diff.added) {
                    attachments.push({
                        fields: [{
                            title: '追加:',
                            value: diff.value,
                        }],
                        color: 'good',
                    });
                }
                if (diff.removed) {
                    attachments.push({
                        fields: [{
                            title: '削除:',
                            value: diff.value,
                        }],
                        color: 'danger',
                    });
                }
            }
            await clients.webClient.chat.postMessage({
                channel: channel,
                text: `<${url}|金井先生のWebサイト>が更新されました。`,
                attachments,
                icon_emoji: `:kanai:`,
            }).then(value => {
                tools.logger.info(`Posted update(s) on Kanai website to the Slack with this attachment: ${JSON.stringify(attachments)}`);
            }).catch(error => {
                tools.logger.error(`Failed to post update(s) on Kanai website to the Slack: ${error}`);
            });
        }
    });
};
