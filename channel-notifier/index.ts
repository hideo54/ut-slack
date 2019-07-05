export default async (clients, tools) => {
    const webClient = clients.webClient;
    const rtmClient = clients.rtmClient;

    rtmClient.on('channel_created', async data => {
        const randomChannelID = tools.channelIDDetector('random');
        await webClient.chat.postMessage({
            channel: randomChannelID,
            text: `<@${data.channel
            .creator}> が <#${data.channel.id}|${data.channel.name}> を作成しました:+1:`,
            username: 'channel-notifier',
            icon_emoji: ':new:',
        });
    });
}