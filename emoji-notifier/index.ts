export default async (clients, tools) => {
    const webClient = clients.webClient;
    const slackEvents = clients.slackEvents;

    slackEvents.on('emoji_changed', async data => {
        const randomChannelID = tools.channelIDDetector('random');
        if (data.subtype === 'add') {
            const message = await webClient.chat.postMessage({
                channel: randomChannelID,
                text: `絵文字 \`:${data.name}:\` が追加されました:+1:`,
                username: 'emoji-notifier',
                icon_emoji: `:${data.name}:`,
            });
            webClient.reactions.add({
                name: data.name,
                channel: message.channel,
                timestamp: message.ts
            }).then(value => {
                tools.logger.info(`Notified addition of :${data.name}: emoji to the Slack`);
            }).catch(error => {
                tools.logger.error(`Failed to notified addition of :${data.name}: emoji to the Slack: ${error}`);
            });
        } else if (data.subtype === 'remove') {
            const names = data.names.map(name => `\`:${name}:\``);
            await webClient.chat.postMessage({
                channel: randomChannelID,
                text: `絵文字 ${names} が削除されました:cry:`,
                username: 'emoji-notifier',
                icon_emoji: ':innocent:',
            }).then(value => {
                tools.logger.info(`Notified deletion of ${names} emoji to the Slack`);
            }).catch(error => {
                tools.logger.error(`Failed to notify deletion of ${names} emoji to the Slack: ${error}`);
            });
        }
    });
}