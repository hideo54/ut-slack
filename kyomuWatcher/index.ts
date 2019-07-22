import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as schedule from 'node-schedule';

const parseNotice = async (dt: Element, dd: Element) => {
    const date = dt.textContent;
    const common = 'http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/images/common';
    const categoryIcons = {
        学籍: `${common}/news_z_1.gif`,
        履修: `${common}/news_z_2.gif`,
        授業: `${common}/news_z_3.gif`,
        試験: `${common}/news_z_4.gif`,
        成績: `${common}/news_z_5.gif`,
        進学: `${common}/news_z_6.gif`,
        教職: `${common}/news_z_7.gif`,
        留学: `${common}/news_z_8.gif`,
        システム: `${common}/news_z_9.gif`,
        窓口: `${common}/news_z_10.gif`,
        その他: `${common}/news_z_11.gif`,
    };
    const targetIcons = {
        '1年生': `${common}/news_z_firstyear.gif`,
        '2年生': `${common}/news_z_secondyear.gif`,
        '1年生, 2年生': `${common}/news_z_all.gif`,
    };
    const pdfIcon = `${common}/icon_pdf.gif`;
    const importantIcon = `${common}/news_important2.gif`;

    const categoryElement = dt.children[0] as HTMLImageElement;
    const category = Object.entries(categoryIcons).filter(category => category[1] === categoryElement.src)[0][0];
    const targetElement = dt.children[1] as HTMLImageElement;
    const target = Object.entries(targetIcons).filter(target => target[1] === targetElement.src)[0][0];

    const title = dd.children[0].textContent;
    const link = (dd.children[0] as HTMLLinkElement).href;
    let isPDF, isImportant;
    if (dd.children.length === 1) {
        isPDF = false;
        isImportant = false;
    } else if (dd.children.length === 3) {
        isPDF = true;
        isImportant = true;
    } else {
        const element = dd.children[1] as HTMLImageElement;
        isImportant = element.alt === '重要';
        isPDF = !isImportant;
    }
    let body;
    if (isPDF) {
        body = undefined
    } else {
        body = {};
        const source = (await axios.get(link)).data;
        const bodyElement = new JSDOM(source).window.document.getElementById('newslist2');
        bodyElement.removeChild(bodyElement.children[0]); // To remove date, targets
        bodyElement.removeChild(bodyElement.children[0]); // To remove title

        body.HTML = bodyElement.innerHTML;

        const brList = bodyElement.getElementsByTagName('br') as HTMLCollection;
        for (const br of Array.from(brList)) {
            br.outerHTML = '\n';
        }
        const pList = bodyElement.getElementsByTagName('p') as HTMLCollection;
        for (const p of Array.from(pList)) {
            p.outerHTML += '\n';
        }

        body.plainText = bodyElement.textContent.trim();

        const aList = bodyElement.getElementsByTagName('a') as HTMLCollection;
        for (const a of Array.from(aList)) {
            const element = a as HTMLLinkElement
            element.outerHTML = `[[${element.href}|${element.textContent}]]`;
        }
        body.withLinkForSlack = bodyElement
            .textContent
            .trim()
            .replace(/\[\[/g, '<')
            .replace(/\]\]/g, '>');
    }
    return { date, category, target, title, link, body, isPDF, isImportant };
};

const patrol = async cacheName => {
    const url = 'http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/firstyear/index.html';
    const source = (await axios.get(url)).data;
    const list = new JSDOM(source).window.document.querySelector('#newslist2 > dl');
    const cache = JSON.parse(fs.readFileSync(cacheName, 'utf-8'));
    const cachedLatestTitle = cache.kyomuWatcher.latestTitle;
    let index;
    for (let i = 0; i < 20; i += 2) { 
    // 確認できる限り過去最も更新された日は4/1の8回。
    // よってさすがに10個チェックしたら十分だろう。
        const title = list.children[i+1].firstChild.textContent;
        if (title == cachedLatestTitle) {
            index = i;
            break;
        }
    }
    cache.kyomuWatcher.latestTitle = list.children[1].textContent;
    fs.writeFileSync(cacheName, JSON.stringify(cache));
    let news = [];
    while (index > 0) {
        index -= 2;
        news.push(await parseNotice(list.children[index], list.children[index+1]));
    }
    return news;
};

export default async (clients, tools) => {
    schedule.scheduleJob('30 */10 * * * *', async () => {
        const news = await patrol(tools.cacheName);
        if (news.length > 0) {
            tools.logger.log('Got new diffs.');
            const channel = tools.channelIDDetector('random');
            const attachments = news.map(notice => {
                const title = `${notice.isImportant ? '[重要]' : ''} ${notice.title} ${notice.isPDF ? '(PDF)' : ''}`;
                const fields = [
                    {
                        title: '種別',
                        value: notice.category,
                        short: true
                    },
                    {
                        title: '対象',
                        value: notice.target,
                        short: true
                    }
                ];
                if (notice.body !== undefined) {
                    fields.push({
                        title: '本文',
                        value: notice.body.withLinkForSlack,
                        short: false
                    });
                }
                return {
                    title, fields, 
                    title_link: notice.link,
                    color: notice.isImportant ? 'good' : ''
                };
            });
            await clients.webClient.chat.postMessage({
                channel: channel,
                text: '<http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/firstyear/index.html|教務課からのお知らせ>が更新されました。',
                attachments,
                icon_emoji: `:ut-logo:`,
            }).then(value => {
                tools.logger.info(`Posted update(s) on Kyomu website to the Slack with this attachment: ${JSON.stringify(attachments)}`);
            }).catch(error => {
                tools.logger.error(`Failed to post update(s) on Kyomu website to the Slack: ${error}`);
            });
        }
    });
};