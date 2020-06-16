import xml from 'fast-xml-parser';
import h2m from 'h2m';
import Mercury from '@postlight/mercury-parser';
import marked from 'marked';
import axios from 'axios';
import { parse, HTMLElement } from 'node-html-parser';

function replaceMarkdownChars(txt: string | object) {
  let title = (typeof txt === 'string' ? txt : txt['#text']) || '';
  return title.replace(/\[/g, '').replace(/\]/g, '');
}

export function parseOffical(rawXml: string): string {
  try {
    const msg = xml.parse(rawXml);
    const items = msg['msg']['appmsg']['mmreader']['category']['item'] as Array<any>;
    return items.reduce((prev, curr) => {
      let title = h2m(replaceMarkdownChars(curr['title']));
      let url = (curr['url'] as string).replace('xtrack=1', 'xtrack=0');

      return `${prev}[${title}](${url})\n\n`;
    }, '');
  } catch (err) {
    return parseAttach(rawXml);
  }
}

export function parseAttach(rawXml: string) {
  const msg = xml.parse(rawXml.replace(/\<br\/\>/g, '\n'));
  const appmsg = msg['msg']['appmsg'];
  const title = h2m(replaceMarkdownChars(appmsg['title']));
  const desc = h2m(replaceMarkdownChars(appmsg['des']));
  const url = appmsg['url'];

  return `[${title}](${url})\n${desc}`;
}

export function parseContact(rawXml: string) {
  const msg = xml.parse(rawXml, { ignoreAttributes: false, attributeNamePrefix: '' });
  const content = msg['msg'];
  const headerUrl: string = content['bigheadimgurl'] || content['smallheadimgurl'];
  const nickname: string = content['nickname'];
  const province: string = content['province'] || '';
  const city: string = content['city'] || '';
  const wechatid: string = content['alias'] || content['username'];
  const imagestatus = Number.parseInt(content['imagestatus']);
  const sex = Number.parseInt(content['sex']);

  return { headerUrl, nickname, province, city, wechatid, imagestatus, sex };
}

export function parseFriendApplying(rawXml: string) {
  const msg = xml.parse(rawXml, { ignoreAttributes: false, attributeNamePrefix: '' });
  const content = msg['msg'];
  const nickname: string = content['fromnickname'];
  const applyingMsg: string = content['content'];
  const wechatid: string = content['alias'] || content['username'];
  const headerUrl: string = content['bigheadimgurl'] || content['smallheadimgurl'];
  const sex = Number.parseInt(content['sex']);
  const sign: string = content['sign'];

  return { nickname, applyingMsg, wechatid, headerUrl, sex, sign };
}

export async function convertXmlToTelegraphMarkdown(rawXml: string, token: string = '4a1c7c544a7f2e9c146240e92ad4dc9e2e14e3e8a0ec01665ddbc80fbba3') {
  const msg = xml.parse(rawXml);
  const items = msg['msg']['appmsg']['mmreader']['category']['item'] as Array<any>;
  const urls = items.map(async curr => {
    // let title = h2m(replaceMarkdownChars(curr['title']))
    let url = (curr['url'] as string).replace('xtrack=1', 'xtrack=0');

    const { title, content, excerpt } = (await Mercury.parse(url, { contentType: 'markdown' })) as {
      title: string;
      content: string;
      excerpt: string;
    };

    const html = marked(content, {});
    const root = parse(html, {}) as HTMLElement;

    const convert = (n: HTMLElement) => {
      if (n.childNodes.length === 0) return;
      convert(n);
    };
    root.childNodes.map(c => {
      const n = c as HTMLElement;
      return {
        tag: n.tagName
      };
    });

    return { title, url };
  });
}

function testOffical() {
  const offical = `<msg><br/>    <appmsg appid="" sdkver="0"><br/>        <title><![CDATA[出差别踩这些红线！官方解读来了]]></title><br/>        <des><![CDATA[]]></des><br/>        <action></action><br/>        <type>5</type><br/>        <showtype>1</showtype><br/>        <content><![CDATA[]]></content><br/>        <contentattr>0</contentattr><br/>        <url><![CDATA[http://mp.weixin.qq.com/s?__biz=MjM5NjEyMzYxMg==&mid=2657446986&idx=1&sn=a7aed5cac68e7e64df6fa5776879ad8f&chksm=bd7fcaf98a0843efde9b6a638fe376a9a92b1ca7983635c4c9d8f5b8e74226c90d07f731f7dd&scene=0&xtrack=1#rd]]></url><br/>        <lowurl><![CDATA[]]></lowurl><br/>        <appattach><br/>            <totallen>0</totallen><br/>            <attachid></attachid><br/>            <fileext></fileext><br/>        </appattach><br/>        <extinfo></extinfo><br/>        <mmreader><br/>            <category type="20" count="3"><br/>                <name><![CDATA[经济日报]]></name><br/>                <topnew><br/>                    <cover><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06fECxdzMYKW4xg7IhmttJWXHLeIia0ib0Vb6ic2zTSpK2DuQd2KZDW8K3ow/640?wxtype=jpeg&wxfrom=0]]></cover><br/>                    <width>0</width><br/>                    <height>0</height><br/>                    <digest><![CDATA[]]></digest><br/>                </topnew><br/>                <br/>                <item><br/>                    <itemshowtype>0</itemshowtype><br/>                    <title><![CDATA[出差别踩这些红线！官方解读来了]]></title><br/>                    <url><![CDATA[http://mp.weixin.qq.com/s?__biz=MjM5NjEyMzYxMg==&mid=2657446986&idx=1&sn=a7aed5cac68e7e64df6fa5776879ad8f&chksm=bd7fcaf98a0843efde9b6a638fe376a9a92b1ca7983635c4c9d8f5b8e74226c90d07f731f7dd&scene=0&xtrack=1#rd]]></url><br/>                    <shorturl><![CDATA[]]></shorturl><br/>                    <longurl><![CDATA[]]></longurl><br/>                    <pub_time>1564468739</pub_time><br/>                    <cover><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06fECxdzMYKW4xg7IhmttJWXHLeIia0ib0Vb6ic2zTSpK2DuQd2KZDW8K3ow/640?wxtype=jpeg&wxfrom=0]]></cover><br/>                    <tweetid></tweetid><br/>                    <digest><![CDATA[]]></digest><br/>                    <fileid>509963306</fileid><br/>                    <sources><br/>                        <source><br/>                            <name><![CDATA[经济日报]]></name><br/>                        </source><br/>                    </sources><br/>                    <styles></styles><br/>                    <native_url></native_url><br/>                    <del_flag>0</del_flag><br/>                    <contentattr>0</contentattr><br/>                    <play_length>0</play_length><br/>                    <play_url><![CDATA[]]></play_url><br/>                    <player><![CDATA[]]></player><br/>                    <music_source>0</music_source><br/>                    <pic_num>0</pic_num><br/>                    <vid></vid><br/>                    <author><![CDATA[]]></author><br/>                    <recommendation><![CDATA[]]></recommendation><br/>                    <pic_urls></pic_urls><br/>                    <comment_topic_id>920674350779580416</comment_topic_id><br/>                    <cover_235_1><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06fECxdzMYKW4xg7IhmttJWXHLeIia0ib0Vb6ic2zTSpK2DuQd2KZDW8K3ow/640?wxtype=jpeg&wxfrom=0]]></cover_235_1><br/>                    <cover_1_1><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06fss5mMQLWKS1wIZ8C5PDqLCJ4mDf2OGHTXU0oA10SlUHsBZz7kElmEg/300?wxtype=jpeg&wxfrom=0]]></cover_1_1><br/>                    <appmsg_like_type>2</appmsg_like_type><br/>                    <video_width>0</video_width><br/>                    <video_height>0</video_height><br/>                    <is_pay_subscribe>0</is_pay_subscribe><br/>                </item><br/>                <br/>                <item><br/>                    <itemshowtype>0</itemshowtype><br/>                    <title><![CDATA[8月起，这些新规将影响你我生活→]]></title><br/>                    <url><![CDATA[http://mp.weixin.qq.com/s?__biz=MjM5NjEyMzYxMg==&mid=2657446986&idx=2&sn=4d106a5f707dc40f1fa134514944d988&chksm=bd7fcaf98a0843eff57356d70264e2f6303e4add558cc039f20d9011cef52b6f518883efec17&scene=0&xtrack=1#rd]]></url><br/>                    <shorturl><![CDATA[]]></shorturl><br/>                    <longurl><![CDATA[]]></longurl><br/>                    <pub_time>1564468739</pub_time><br/>                    <cover><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06f3hO5wfxibonNOVicciaDmGwA4Uuvxp2ZyAb3OKmC6NQ2M09cwX7ibRGY9g/300?wxtype=jpeg&wxfrom=0]]></cover><br/>                    <tweetid></tweetid><br/>                    <digest><![CDATA[]]></digest><br/>                    <fileid>509963298</fileid><br/>                    <sources><br/>                        <source><br/>                            <name><![CDATA[经济日报]]></name><br/>                        </source><br/>                    </sources><br/>                    <styles></styles><br/>                    <native_url></native_url><br/>                    <del_flag>0</del_flag><br/>                    <contentattr>0</contentattr><br/>                    <play_length>0</play_length><br/>                    <play_url><![CDATA[]]></play_url><br/>                    <player><![CDATA[]]></player><br/>                    <music_source>0</music_source><br/>                    <pic_num>0</pic_num><br/>                    <vid></vid><br/>                    <author><![CDATA[]]></author><br/>                    <recommendation><![CDATA[]]></recommendation><br/>                    <pic_urls></pic_urls><br/>                    <comment_topic_id>920674351517777922</comment_topic_id><br/>                    <cover_235_1><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06f3hO5wfxibonNOVicciaDmGwA4Uuvxp2ZyAb3OKmC6NQ2M09cwX7ibRGY9g/300?wxtype=jpeg&wxfrom=0]]></cover_235_1><br/>                    <cover_1_1><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06f3hO5wfxibonNOVicciaDmGwA4Uuvxp2ZyAb3OKmC6NQ2M09cwX7ibRGY9g/300?wxtype=jpeg&wxfrom=0]]></cover_1_1><br/>                    <appmsg_like_type>2</appmsg_like_type><br/>                    <video_width>0</video_width><br/>                    <video_height>0</video_height><br/>                    <is_pay_subscribe>0</is_pay_subscribe><br/>                </item><br/>                <br/>                <item><br/>                    <itemshowtype>0</itemshowtype><br/>                    <title><![CDATA[边充电边玩手机，真的会炸吗？是时候科普一下了]]></title><br/>                    <url><![CDATA[http://mp.weixin.qq.com/s?__biz=MjM5NjEyMzYxMg==&mid=2657446986&idx=3&sn=112c2294d8d5e7eb0a904e98b9604103&chksm=bd7fcaf98a0843ef644cb1d98c9badedc897306014052bde7ac81540254eddbfa12c8032f2bd&scene=0&xtrack=1#rd]]></url><br/>                    <shorturl><![CDATA[]]></shorturl><br/>                    <longurl><![CDATA[]]></longurl><br/>                    <pub_time>1564468739</pub_time><br/>                    <cover><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06f05zL7o7Gf0QUWAy5JPFhZom6ccZYw7UybN2K4icQNPcXwcNHLHEiaNEw/300?wxtype=jpeg&wxfrom=0]]></cover><br/>                    <tweetid></tweetid><br/>                    <digest><![CDATA[]]></digest><br/>                    <fileid>509963256</fileid><br/>                    <sources><br/>                        <source><br/>                            <name><![CDATA[经济日报]]></name><br/>                        </source><br/>                    </sources><br/>                    <styles></styles><br/>                    <native_url></native_url><br/>                    <del_flag>0</del_flag><br/>                    <contentattr>0</contentattr><br/>                    <play_length>0</play_length><br/>                    <play_url><![CDATA[]]></play_url><br/>                    <player><![CDATA[]]></player><br/>                    <music_source>0</music_source><br/>                    <pic_num>0</pic_num><br/>                    <vid></vid><br/>                    <author><![CDATA[]]></author><br/>                    <recommendation><![CDATA[]]></recommendation><br/>                    <pic_urls></pic_urls><br/>                    <comment_topic_id>920674352205643776</comment_topic_id><br/>                    <cover_235_1><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06f05zL7o7Gf0QUWAy5JPFhZom6ccZYw7UybN2K4icQNPcXwcNHLHEiaNEw/300?wxtype=jpeg&wxfrom=0]]></cover_235_1><br/>                    <cover_1_1><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06f05zL7o7Gf0QUWAy5JPFhZom6ccZYw7UybN2K4icQNPcXwcNHLHEiaNEw/300?wxtype=jpeg&wxfrom=0]]></cover_1_1><br/>                    <appmsg_like_type>2</appmsg_like_type><br/>                    <video_width>0</video_width><br/>                    <video_height>0</video_height><br/>                    <is_pay_subscribe>0</is_pay_subscribe><br/>                </item><br/>                <br/>            </category><br/>            <publisher><br/>                <username></username><br/>                <nickname><![CDATA[经济日报]]></nickname><br/>            </publisher><br/>            <template_header></template_header><br/>            <template_detail></template_detail><br/>            <forbid_forward>0</forbid_forward><br/>        </mmreader><br/>        <thumburl><![CDATA[https://mmbiz.qpic.cn/mmbiz_jpg/3QdXlNYeWk14JC4gwag92zSISnfnL06fECxdzMYKW4xg7IhmttJWXHLeIia0ib0Vb6ic2zTSpK2DuQd2KZDW8K3ow/640?wxtype=jpeg&wxfrom=0]]></thumburl><br/>    </appmsg><br/>    <fromusername></fromusername><br/>    <appinfo><br/>        <version></version><br/>        <appname><![CDATA[经济日报]]></appname><br/>        <isforceupdate>1</isforceupdate><br/>    </appinfo><br/>    <br/>    <br/>    <br/>    <br/>    <br/>    <br/></msg>`;
  console.log(parseOffical(offical));
}

function testAttach() {
  const att = `<?xml version="1.0"?><br/><msg><br/>	<appmsg appid="" sdkver="0"><br/>		<title>靠印钞支撑的复兴梦，是如何崩掉的？</title><br/>		<des>作死的！</des><br/>		<action /><br/>		<type>5</type><br/>		<showtype>0</showtype><br/>		<soundtype>0</soundtype><br/>		<mediatagname /><br/>		<messageext /><br/>		<messageaction /><br/>		<content /><br/>		<contentattr>0</contentattr><br/>		<url>http://mp.weixin.qq.com/s?__biz=MzAxNzczMTY2Ng==&amp;mid=2648625685&amp;idx=1&amp;sn=1650bc329f928bd5b14d43bbca4cb65b&amp;chksm=83cb6b28b4bce23e7b002f67760f679144c1f822a4ff6f8d7e3eecbe48fdee6d3b2e6fec2984&amp;scene=0&amp;xtrack=1#rd</url><br/>		<lowurl /><br/>		<dataurl /><br/>		<lowdataurl /><br/>		<songalbumurl /><br/>		<songlyric /><br/>		<appattach><br/>			<totallen>0</totallen><br/>			<attachid /><br/>			<emoticonmd5 /><br/>		<fileext /><br/>			<cdnthumbaeskey /><br/>			<aeskey /><br/>		</appattach><br/>		<extinfo /><br/>	<sourceusername></sourceusername><br/>		<sourcedisplayname>财主家的余粮</sourcedisplayname><br/>		<thumburl>https://mmbiz.qpic.cn/mmbiz_jpg/r4Em8wOBKDicia3Chia2gKTHWPBmENdibPVLYG5wLxn5GhiaYj3gQVCWb26GYCSodWAzP9QpCe7f0wnM02lFNMSqcgA/300?wxtype=jpeg&amp;wxfrom=0</thumburl><br/>	<md5 /><br/>		<statextstr /><br/>		<mmreadershare><br/>			<itemshowtype>0</itemshowtype><br/>			<nativepage>0</nativepage><br/>			<pubtime>1564394943</pubtime><br/>			<duration>0</duration><br/>			<width>0</width><br/>			<height>0</height><br/>			<vid /><br/>			<funcflag>0</funcflag><br/>		</mmreadershare><br/>	</appmsg><br/>	<fromusername></fromusername><br/>	<scene>0</scene><br/>	<appinfo><br/>		<version>1</version><br/>		<appname></appname><br/>	</appinfo><br/>	<commenturl></commenturl><br/></msg><br/>`;
  console.log(parseAttach(att));
}

function testPic() {
  const pic = `<?xml version="1.0"?><br/><msg><br/>	<appmsg appid="" sdkver="0"><br/>		<title>20190804 行情分析<br/>（今天有点事情简更一下<img class="emoji emoji1f64f" text="_web" src="/zh_CN/htmledition/v2/images/spacer.gif" />🏻）</title><br/>		<des>20190804 行情分析<br/>（今天有点事情简更一下<img class="emoji emoji1f64f" text="_web" src="/zh_CN/htmledition/v2/images/spacer.gif" />🏻）</des><br/>		<action /><br/>		<type>5</type><br/>		<showtype>0</showtype><br/>		<soundtype>0</soundtype><br/>		<mediatagname /><br/>		<messageext /><br/>		<messageaction /><br/>		<content /><br/>		<contentattr>0</contentattr><br/>		<url>http://mp.weixin.qq.com/s?__biz=MzU1NzIxOTE2Mw==&amp;mid=2247486208&amp;idx=1&amp;sn=6d760535050133defe1f9de17d3e38d2&amp;chksm=fc386734cb4fee221d5ec93da95757e1fbe354a0d698df4f98d53b8097f14950138a05018ba2&amp;scene=0&amp;xtrack=1#rd</url><br/>		<lowurl /><br/>		<dataurl /><br/>		<lowdataurl /><br/>		<songalbumurl /><br/>		<songlyric /><br/>		<appattach><br/>			<totallen>0</totallen><br/>			<attachid /><br/>			<emoticonmd5 /><br/>			<fileext /><br/>			<cdnthumbaeskey /><br/>			<aeskey /><br/>		</appattach><br/>		<extinfo /><br/>		<sourceusername></sourceusername><br/>		<sourcedisplayname>果酱之链</sourcedisplayname><br/>		<thumburl>https://mmbiz.qpic.cn/mmbiz_jpg/TT9VgDtkqIUEUr41ToT7CPSiaoD1H3O4BJStZoIibhxl4Pn4rxA6ias0LbGq92ktmvN9cFP1GaDMNCaoYsBGgN8uw/640?wxfrom=0</thumburl><br/>		<md5 /><br/>		<statextstr /><br/>		<mmreadershare><br/>			<itemshowtype>8</itemshowtype><br/>			<nativepage>0</nativepage><br/>			<pubtime>1564912371</pubtime><br/>			<duration>0</duration><br/>			<width>0</width><br/><height>0</height><br/>			<vid /><br/>			<funcflag>0</funcflag><br/>		</mmreadershare><br/>	</appmsg><br/<fromusername></fromusername><br/>	<scene>0</scene><br/>	<appinfo><br/>		<version>1</version><br/>		<appname></appname><br/>	</appinfo><br/>	<commenturl></commenturl><br/></msg><br/>`;
  console.log(parseAttach(pic));
}

function testBr() {
  const br = `<?xml version="1.0"?><br/><msg><br/>	<appmsg appid="" sdkver="0"><br/>		<title>纤云弄巧，飞星传恨，银汉迢迢暗度。<br/>金风玉露一相逢，便胜却、人间无数。<br/>柔情似水，佳期如梦，忍顾鹊桥归路。<br/>两情若是久长时，又岂在、朝朝暮暮。<br/><br/>百度AI交互设计院<img class="emoji emoji3297" text="_web" src="/zh_CN/htmledition/v2/images/spacer.gif" />️天下有情人终成眷属， 借此良辰吉日诚邀各路英雄好汉体验百度AI小程序，附赠七夕心意一份，希望幸运的您可以被选中。</title><br/>		<des>纤云弄巧，飞星传恨，银汉迢迢暗度。<br/>金风玉露一相逢，便胜却、人间无数。<br/>柔情似水，佳期如梦，忍顾鹊桥归路。<br/>两情若是久长时，又岂在、朝朝暮暮。<br/><br/>百度AI交互设计院<img class="emoji emoji3297" text="_web" src="/zh_CN/htmledition/v2/images/spacer.gif" />️天下有情人终成眷属， 借此良辰吉日诚邀各路英雄好汉体验百度AI小程序，附赠七夕心意一份，希望幸运的您可以被选中。</des><br/>		<action /><br/>		<type>5</type><br/>		<showtype>0</showtype><br/>		<soundtype>0</soundtype><br/>		<mediatagname /><br/>		<messageext /><br/>		<messageaction /><br/>		<content /><br/>		<contentattr>0</contentattr><br/>	<url>http://mp.weixin.qq.com/s?__biz=MzU0OTUzMjUwOA==&amp;mid=2247486316&amp;idx=1&amp;sn=9ad9437503c9d17b21f114fb7300a042&amp;chksm=fbaf2d5fccd8a4490c596ad20ac666f39ac0ec2810cc9c94d9e831ee782612894d9253719ef5&amp;scene=0&amp;xtrack=1#rd</url><br/>		<lowurl /><br/>		<dataurl /><br/>		<lowdataurl /><br/>		<songalbumurl /><br/>		<songlyric /><br/>		<appattach><br/>			<totallen>0</totallen><br/>			<attachid /><br/>			<emoticonmd5 /><br/>			<fileext /><br/>	<cdnthumbaeskey /><br/>			<aeskey /><br/>		</appattach><br/>		<extinfo /><br/>		<sourceusername></sourceusername><br/>		<sourcedisplayname>百度AI交互设计院</sourcedisplayname><br/>		<thumburl>https://mmbiz.qpic.cn/mmbiz_jpg/iacQlDibO9CB5aBiaVw3opHv7RlzEgtAhhL35hN5gIdia3JncfQ2R8Xv4eFKnlmibhiczebWB3MV0SmUU373Vu2cWicGA/640?wxfrom=0</thumburl><br/>		<md5 /><br/>		<statextstr /><br/>		<mmreadershare><br/>			<itemshowtype>8</itemshowtype><br/>			<nativepage>0</nativepage><br/>			<pubtime>1565162314</pubtime><br/>			<duration>0</duration><br/>			<width>0</width><br/>			<height>0</height><br/>			<vid /><br/>			<funcflag>0</funcflag><br/>		</mmreadershare><br/>	</appmsg><br/>	<fromusername></fromusername><br/>	<scene>0</scene><br/>	<appinfo><br/>		<version>1</version><br/>		<appname></appname><br/>	</appinfo><br/>	<commenturl></commenturl><br/></msg><br/>`;
  console.log(parseAttach(br));
}

function testContact() {
  const xml = `<?xml version="1.0"?><msg bigheadimgurl="http://wx.qlogo.cn/mmhead/ver_1/bCJ9aEldftezjWYicefCsDMKyeicVGIlbKMicTCI06QtDAng93uhZUzv4Kwn4wyCauvnPSlic545lYaqwBuErrVrPomNR777oXcZuM7ymQZAbho/0" smallheadimgurl="http://wx.qlogo.cn/mmhead/ver_1/bCJ9aEldftezjWYicefCsDMKyeicVGIlbKMicTCI06QtDAng93uhZUzv4Kwn4wyCauvnPSlic545lYaqwBuErrVrPomNR777oXcZuM7ymQZAbho/132" username="wxid_z5giqsbr9m9u22" nickname="yo"  shortpy="" alias="yoyo" imagestatus="4" scene="17" province="Hubei" city="China's Mainland" sign="" sex="0" certflag="0" certinfo="" brandIconUrl="" brandHomeUrl="" brandSubscriptConfigUrl="" brandFlags="0" regionCode="CN_Hubei" />`;

  console.log(parseContact(xml));
}

function testFriendApplying() {
  const xml = `<msg fromusername="wxid_sszwios8dd9711" encryptusername="v1_27d6514b78dad48241d7db28d31d65ddf1e9229588a6851efde6df04309037c4d2179e88a19051841318422561687749@stranger" fromnickname="游人@PW DeFi" content="我是群聊&quot;DeFi 市值重回 10 亿美元&quot;的游人@PW DeFi"  shortpy="YRPWDEFI" imagestatus="3" scene="14" country="SG" province="" city="" sign="专注互联网  0投资项目 " percard="1" sex="1" alias="fcc199299" weibo="" albumflag="3" albumstyle="0" albumbgimgid="913350565298176_913350565298176" snsflag="433" snsbgimgid="http://szmmsns.qpic.cn/mmsns/bSHDrzBibeN8oricMDKUeCSTumav19fw9kY35zibFgGqkjFU8Saic70Hx1pcOGUzIcCV1w6LNZXT3Ao/0" snsbgobjectid="13216836968078061747" mhash="8f77f6504b731611e017c11b624d9f84" mfullhash="8f77f6504b731611e017c11b624d9f84" bigheadimgurl="http://wx.qlogo.cn/mmhead/ver_1/8w6ounbEkKsf8gh7LrgZ4Y1D0t59MXBKTBownE6PAPibLJuSpBJaOjkhBH5dpYHLjPxQZ47V45GgfibeiarH8gukquGgSZvV9Px5Uhr4AdEW0E/0" smallheadimgurl="http://wx.qlogo.cn/mmhead/ver_1/8w6ounbEkKsf8gh7LrgZ4Y1D0t59MXBKTBownE6PAPibLJuSpBJaOjkhBH5dpYHLjPxQZ47V45GgfibeiarH8gukquGgSZvV9Px5Uhr4AdEW0E/132" ticket="v4_000b708f0b040000010000000000741ca182764cc07b52b3da49e85e1000000050ded0b020927e3c97896a09d47e6e9ea458531600f1d484619e74176d9bc286f765a268b353238d09e576dcd99b93e357ed2a1a9a81d687b527e678bf576f4d733560956677ea4b61a1eb317d538ba6b86c78bd02cf6ab8c9e0e9dc6f22be6a9a363f38e0fed00e5950b82d7337d395bec20c6d40@stranger" opcode="2" googlecontact="" qrticket="" chatroomusername="22388091580@chatroom" sourceusername="" sourcenickname="" sharecardusername="" sharecardnickname="" cardversion=""><brandlist count="0" ver="740984737"></brandlist></msg>`;
  console.log(parseFriendApplying(xml));
}

// testContact();
// testFriendApplying();
// testOffical();
// testAttach();
// testPic();
// testBr();
