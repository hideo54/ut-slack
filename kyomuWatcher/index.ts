import axios from 'axios';
import scrapeIt from 'scrape-it';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as schedule from 'node-schedule';
import { stripIndent } from 'common-tags';

const common = 'http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/images/common';
enum Category {
    '学籍', '履修', '授業', '試験', '成績', '進学', '教職', '留学', 'システム', '窓口', 'その他',
}
const categoryIcons: {[key in keyof typeof Category]: string} = {
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

enum Target {
    '1年生', '2年生', '1年生, 2年生'
}
const targetIcons: {[key in keyof typeof Target]: string} = {
    '1年生': `${common}/news_z_firstyear.gif`,
    '2年生': `${common}/news_z_secondyear.gif`,
    '1年生, 2年生': `${common}/news_z_all.gif`,
};

const PDFIcon = `${common}/icon_pdf.gif`;
const importantIcon = `${common}/news_important2.gif`;

interface Body {
    HTML: string;
    plainText: string;
    slackText: string;
}

interface Notice {
    title: string;
    url: string;
    category: Category | undefined;
    target: Target;
    body?: Body;
    isPDF: boolean;
    isImportant: boolean;
}

const parseBody = async (notice: Notice) => {
    let body = {};
    const source = (await axios.get(notice.url)).data;
    const bodyElement = new JSDOM(source).window.document.getElementById('newslist2');
    bodyElement.removeChild(bodyElement.children[0]); // To remove date, targets
    bodyElement.removeChild(bodyElement.children[0]); // To remove title
    Object.assign(body, { HTML: bodyElement.innerHTML });

    const brList = bodyElement.getElementsByTagName('br') as HTMLCollection;
    for (const br of Array.from(brList)) {
        br.outerHTML = '\n';
    }
    const pList = bodyElement.getElementsByTagName('p') as HTMLCollection;
    for (const p of Array.from(pList)) {
        p.outerHTML += '\n';
    }
    Object.assign(body, { plainText: bodyElement.textContent.trim() });

    const aList = bodyElement.getElementsByTagName('a') as HTMLCollection;
    for (const a of Array.from(aList)) {
        const element = a as HTMLLinkElement
        element.outerHTML = `[[${element.href}|${element.textContent}]]`;
    }
    Object.assign(body, {
        slackText: bodyElement
            .textContent
            .trim()
            .replace(/\[\[/g, '<')
            .replace(/\]\]/g, '>')
    });
    return Object.assign(notice, { body });
};

const patrol = async tools => {
    const url = 'http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/firstyear/index.html';
    interface Result {
        meta: {
            category: Category;
            target: Target;
        };
        notices: Notice[];
    }
    const scrapedData: scrapeIt.ScrapeResult<Result> = await scrapeIt(url, {
        meta: {
            listItem: '#newslist2 > dl > dt',
            data: {
                category: {
                    selector: 'img:first-child',
                    attr: 'src',
                    convert: src => {
                        for (const category of Object.keys(categoryIcons)) {
                            if (src === categoryIcons[category]) {
                                return category;
                            }
                        }
                    },
                },
                target: {
                    selector: 'img:last-child',
                    attr: 'src',
                    convert: src => {
                        for (const target of Object.keys(targetIcons)) {
                            if (src === targetIcons[target]) {
                                return target;
                            }
                        }
                    },
                },
            }
        },
        notices: {
            listItem: '#newslist2 > dl > dd',
            data: {
                title: 'a',
                url: {
                    selector: 'a',
                    attr: 'href',
                },
                isPDF: {
                    selector: 'img',
                    attr: 'src',
                    convert: src => src === PDFIcon,
                },
                isImportant: {
                    selector: 'img:last-child',
                    attr: 'src',
                    convert: src => src === importantIcon,
                },
            },
        },
    });
    const { notices, meta } = scrapedData.data;
    for (const i in notices) {
        Object.assign(notices[i], meta[i]);
    }
    const cache = JSON.parse(fs.readFileSync(tools.cacheName, 'utf-8'));
    const cachedLatestURL = cache.kyomuWatcher.latestURL;
    const newNotices: Notice[] = [];
    for (const notice of notices) {
        if (notice.url === cachedLatestURL) {
            break;
        }
        if (notice.isPDF) {
            newNotices.push(notice);
        } else {
            const detailedNotice = await parseBody(notice);
            newNotices.push(detailedNotice);
        }
    }
    cache.kyomuWatcher.latestURL = notices[0].url;
    fs.writeFileSync(tools.cacheName, JSON.stringify(cache));
    return newNotices;
};

export default async (clients, tools) => {
    schedule.scheduleJob('* * * * *', async () => {
        const newNotices = await patrol(tools);
        if (newNotices.length > 0) {
            tools.logger.info('Got new diffs');
            const channel = tools.channelIDDetector('random');
            const callsMember: boolean = newNotices.filter(notice => notice.isImportant).length > 0;
            const text = '<http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/firstyear/index.html|教務課からのお知らせ>が更新されました。';
            const attachments = newNotices.map(notice => {
                const title = `${notice.isImportant ? '[重要]' : ''} ${notice.title} ${notice.isPDF ? '(PDF)' : ''}`;
                const fields = [
                    {
                        title: '種別',
                        value: notice.category.toString(),
                        short: true
                    },
                    {
                        title: '対象',
                        value: notice.target.toString(),
                        short: true
                    }
                ];
                if (notice.body !== undefined) {
                    fields.push({
                        title: '本文',
                        value: notice.body.slackText,
                        short: false
                    });
                }
                return {
                    title, fields, 
                    title_link: notice.url,
                    color: notice.isImportant ? 'good' : ''
                };
            });
            await clients.webClient.chat.postMessage({
                channel,
                text: callsMember ? `<!channel> ${text}` : text,
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