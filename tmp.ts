import axios from 'axios';
import scrapeIt from 'scrape-it';
import cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as schedule from 'node-schedule';

(async () => {
    const url = 'http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/firstyear/2019/0704160000.html';
    const body = {};
    const source = (await axios.get(url)).data;
    const $ = cheerio.load(source, { decodeEntities: false });
    $('#newslist2 > p:first-child').remove(); // To remove date, targets
    $('#newslist2 > h2:first-child').remove(); // To remove title
    const html = $('#newslist2').html();
    Object.assign(body, { HTML: JSON.parse(JSON.stringify(html)) });

    const main = cheerio.load(html.replace(/<br\/?\>/, '\n'), { decodeEntities: false });
    main('a').each((index, element) => {
        const inner = main(element).text();
        const href = element.attribs.href;
        const slackLinkText = `[[${inner}|${href}]]`;
        // main(element).html(slackLink.Text);
    });
    console.log(main('').text());

    console.log(body);
})();