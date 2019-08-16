# ut-slack

東京大学理科1類34組Slackで動かされているSlack botのソースコードです。

## Features

* 新規チャンネルが作成されたことを通知する (channel-notifier)
* 新規絵文字が作成されたことを通知する (emoji-notifier)
* [前期課程教務課からのお知らせ](http://www.c.u-tokyo.ac.jp/zenki/news/kyoumu/index.html)を通知する (kyomuWatcher)
* [金井雅彦先生の講義受講者向けウェブサイト](https://www.ms.u-tokyo.ac.jp/~mkanai/culc1/)の変更を通知する (kanaiWatcher)

## Setup

1. `cp sample.env .env` and edit `.env` appropriately
1. `cp cache.sample.json cache.json`

## Licenses

* `emoji-notifier` and `channel-notifier` are inspired by [TSG's Slack bot](https://github.com/tsg-ut/slackbot). Thanks a lot!