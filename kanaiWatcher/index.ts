import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as iconv from 'iconv-lite';
import * as fs from 'fs';
import * as diff from 'diff';
import * as schedule from 'node-schedule';

const patrol = async cacheName => {
    const url = 'https://www.ms.u-tokyo.ac.jp/~mkanai/culc1/';
    const source_SJIS = (await axios.get(url, {
        responseType: 'arraybuffer',
    })).data;
    const source = iconv.decode(source_SJIS, 'Shift_JIS');
    const dom = new JSDOM(source).window.document.body;
    const latestContent = {
        source: dom.innerHTML,
        text: dom.textContent
    };
    const cache = JSON.parse(fs.readFileSync(cacheName, 'utf-8'));
    const cachedContent = cache.kanaiWatcher;
    const diffs = diff.diffChars(cachedContent.text, latestContent.text).filter(diff => diff.added || diff.removed);
    cache.kanaiWatcher = latestContent;
    fs.writeFileSync(cacheName, JSON.stringify(cache));
    return diffs;
};

export default async (clients, tools) => {
    schedule.scheduleJob('*/10 * * * *', async () => {
        const diffs = await patrol(tools.cacheName);
        if (diffs.length > 0) {
            const channel = tools.channelIDDetector('微分積分学1');
            const attachments = diffs.map(diff => {
                if (diff.added) {
                    return {
                        "fields": [{
                            "title": "追加:",
                            "value": diff.value
                        }],
                        "color": "good"
                    };
                }
                if (diff.removed) {
                    return {
                        "fields": [{
                            "title": "削除:",
                            "value": diff.value
                        }],
                        "color": "danger"
                    };
                }
            });
            await clients.webClient.chat.postMessage({
                channel: channel,
                text: '<https://www.ms.u-tokyo.ac.jp/~mkanai/culc1/|金井先生のWebサイト>が更新されました。',
                attachments,
                icon_emoji: `:kanai:`,
            });
        }
    });
};