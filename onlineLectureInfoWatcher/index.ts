import scrapeIt from 'scrape-it';
import { promises as fs } from 'fs';
import { diffArrays } from 'diff';
import { scheduleJob } from 'node-schedule';
import { Clients, Tools } from '../types';

const url = 'https://komabataskforce.wixsite.com/forstudents';

interface SiteData {
    lastUpdated: string;
    paragraphs: string[];
}

const fetchCurrentSiteData = async () => {
    const result = await scrapeIt<SiteData>(url, {
        lastUpdated: {
            selector: 'div#comp-k8515tfz p',
            convert: s => s.replace(/^last updated at ([a-zA-Z0-9,: ]*)$/, (m, date) => date),
        },
        paragraphs: {
            listItem: 'div#comp-k844k5vo p',
        },
    });
    const data = result.data;
    data.paragraphs = (data.paragraphs.filter(s => typeof s === 'string'
        && s !== '​' // This is U+200B (zero width space), not an empty string.
    ));
    return data;
};

const makeDiffs = async (cacheName: string, currentData: SiteData) => {
    const cache = JSON.parse(await fs.readFile(cacheName, 'utf-8'));
    const cachedData = cache.onlineLectureInfoWatcher as SiteData;
    const lastUpdated = cachedData.lastUpdated;
    const paragraphDiffs = diffArrays(cachedData.paragraphs, currentData.paragraphs);
    cache.onlineLectureInfoWatcher = currentData;
    await fs.writeFile(cacheName, JSON.stringify(cache));
    return { lastUpdated, paragraphDiffs };
};

export default async (clients: Clients, tools: Tools) => {
    scheduleJob('*/5 * * * *', async () => {
        const currentData = await fetchCurrentSiteData();
        const diffData = await makeDiffs(tools.cacheName, currentData);
        const diffs = diffData.paragraphDiffs.filter(x => x.added || x.removed);
        if (diffs.length > 0) {
            tools.logger.info('Got new diffs.');
            let attachments = [];
            for (const diff of diffs) {
                for (const value of diff.value) {
                    attachments.push({
                        fields: [{
                            title: diff.added ? '追加: ' : '削除:',
                            value: value,
                        }],
                        color: diff.added ? 'good' : 'danger',
                    });
                }
            }
            const text = `<${url}|講義オンライン化に関する情報サイト>が更新されました。(前回の更新: ${diffData.lastUpdated})`;
            const channel = tools.channelIDDetector('講義オンライン化に関する情報サイト');
            const username = '講義オンライン化に関する情報サイト';
            const icon_emoji = ':ut-logo:';
            const firstResponse = await clients.webClient.chat.postMessage({
                channel, text, username, icon_emoji,
            });
            // @ts-ignore
            const thread_ts = firstResponse.message.ts;
            while (attachments.length > 5) {
                await clients.webClient.chat.postMessage({
                    channel, text, username, icon_emoji, thread_ts,
                    attachments: attachments.slice(0, 5),
                });
                attachments = attachments.slice(5);
            }
            await clients.webClient.chat.postMessage({
                channel, text, username, icon_emoji, thread_ts,
                attachments,
            });
        }
    });
};