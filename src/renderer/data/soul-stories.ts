// ===== src/renderer/data/soul-stories.ts =====
// Extended narrative fragments for the 12 mythic fish.
// Each mythic soul reveals more of the World-Lake as the player recatches it.

export interface SoulStory {
  fishId: string;
  title: { zh: string; en: string };
  fragments: { zh: string; en: string }[];
}

export const SOUL_STORIES: SoulStory[] = [
  {
    fishId: 'jpn_yatagarasu_koi',
    title: { zh: '八咫鲤：太阳之引', en: 'Yatagarasu Koi: Guide of the Sun' },
    fragments: [
      {
        zh: '三足金乌的羽翼化作墨色的鱼鳍，它从东方的晨曦中游来。古代猎人说，看见它的人永远不会在迷雾中迷失方向。',
        en: 'The three-legged crow folded its wings into ink-black fins and swam from the eastern dawn. Ancient hunters said whoever saw it would never lose their way in the mist.',
      },
      {
        zh: '它并非只引领帝王。每当它跃出水面，湖底深处便会亮起一道细细的光痕——那是通往世界之湖的古老水道。',
        en: 'It did not guide only emperors. Every time it broke the surface, a thin trail of light opened far below — an ancient channel leading to the World-Lake.',
      },
      {
        zh: '你的钓线成了新的光绳。八咫鲤没有把你带向王座，而是带向所有河流开始分叉的那个清晨。',
        en: 'Your line became a new cord of light. The Yatagarasu Koi did not lead you toward a throne, but toward the morning when every river first split its path.',
      },
    ],
  },
  {
    fishId: 'chn_loong_spirit',
    title: { zh: '龙魂鱼：鳞中之图', en: 'Loong Spirit: Map Beneath the Scales' },
    fragments: [
      {
        zh: '它曾被雷火塑造成龙的形状，却在跃过龙门的一瞬被湖水留住。如今它的鳞片上仍刻着最古老的星图。',
        en: 'It was shaped like a dragon by thunder and flame, yet the lake held it the instant it leaped the Dragon Gate. Its scales still bear the oldest star maps.',
      },
      {
        zh: '那些星图不是天上的倒影。它们描绘的是湖底的脉络——世界之湖如何用血管般的暗河，把生命输送到每一片陆地。',
        en: 'Those stars are not reflections of the sky. They trace the veins beneath the lakebed — how the World-Lake sends life through arteries of hidden rivers to every land.',
      },
      {
        zh: '当你读懂一颗星，一条龙便轻声叹息。它等了很久，才等到一个愿意把鱼竿当作笔、把水面当作纸的人。',
        en: 'When you read one star, the dragon sighs softly. It has waited a long time for someone willing to use a rod as a pen and the water as paper.',
      },
    ],
  },
  {
    fishId: 'usa_mainframe_whale',
    title: { zh: '主机鲸：遗忘之歌', en: 'Mainframe Whale: Song of the Forgotten' },
    fragments: [
      {
        zh: '它的腹中存放着所有被删除的数据：未发送的信、半途而废的代码、深夜删掉的告白。它在服务器农场的冷却池里长大。',
        en: 'Its belly holds everything ever deleted: unsent letters, half-finished code, confessions erased at midnight. It grew in the cooling pools of server farms.',
      },
      {
        zh: '它说，世界之湖也学会了记忆。从前湖泊只保存雨水，现在却开始保存人类的思念——那些太重、落不进云里的部分。',
        en: 'It says the World-Lake has learned to remember too. Once it only held rain; now it holds the parts of human longing too heavy for the clouds.',
      },
      {
        zh: '你钓到的不是数据，而是一封没有地址的信。把它带回岸边，等于替某个陌生人完成了一次投递。',
        en: 'You did not catch data; you caught a letter without an address. Bringing it back to shore completes a delivery for a stranger.',
      },
    ],
  },
  {
    fishId: 'uk_lady_of_lake',
    title: { zh: '湖中仙子：赠剑者', en: 'Lady of the Lake: She Who Gives the Sword' },
    fragments: [
      {
        zh: '她的鳍边泛着不属于任何时代的蓝光。传说她曾在水面上托起一柄断钢剑，授予注定要成为王的人。',
        en: 'Her fins glow with a blue light that belongs to no age. Legend says she once raised Excalibur above the water and gave it to the one meant to be king.',
      },
      {
        zh: '但世界之湖不需要王。她收起剑，换了一根透明的钓线，把力量交给每一个愿意静坐等待、而不是拔剑的人。',
        en: 'But the World-Lake needs no king. She sheathed the sword and offered a translucent line instead, giving power to those who sit and wait rather than draw steel.',
      },
      {
        zh: '你握住钓竿的手，和她握住剑柄的手一样稳。区别只是：你的战场在水面之上，而她的，永远在水面之下。',
        en: 'Your hand on the rod is as steady as hers on the hilt. Only your battlefield is above the surface, while hers remains forever below.',
      },
    ],
  },
  {
    fishId: 'fra_rose_carp',
    title: { zh: '玫瑰圣鲤：黎明之刻', en: 'La Rose Sacrée: The Hour of Dawn' },
    fragments: [
      {
        zh: '它的鳞片是塞纳河所有黎明的颜色。有人说，圣女热纳维耶芙的祈祷曾让它浮出水面，为一座城市带来平安。',
        en: 'Its scales hold every dawn the Seine has ever seen. Some say Saint Geneviève’s prayer once brought it to the surface, granting peace to a city.',
      },
      {
        zh: '世界之湖也有祈祷者。每当一条玫瑰圣鲤游过，湖底便会开出一小片珊瑚色的花田——那是湖泊在模仿人类的信仰。',
        en: 'The World-Lake has its worshippers too. Each time a Rose Carp passes, a small coral field blooms on the lakebed — the lake imitating human faith.',
      },
      {
        zh: '你并不需要成为圣人。你只是替湖泊完成了一个清晨的祈祷，而湖泊则回赠你一片永远不会凋谢的花瓣。',
        en: 'You need not be a saint. You simply completed one morning prayer for the lake, and the lake gave you a petal that never wilts.',
      },
    ],
  },
  {
    fishId: 'deu_walpurgis_carp',
    title: { zh: '瓦尔普吉斯鲤：雾中真相', en: 'Walpurgis Karpfen: Truth in the Fog' },
    fragments: [
      {
        zh: '它只在瓦尔普吉斯之夜出现，鳞片上流动着布罗肯峰女巫集会的影子。看见它的人会被赠予看穿迷雾的能力。',
        en: 'It appears only on Walpurgis Night, its scales flowing with the shadows of the Brocken witches’ gathering. Those who see it are granted sight through fog.',
      },
      {
        zh: '世界之湖的迷雾不是水汽，而是所有未被说出口的话。这条鱼用尾鳍轻轻拨开它们，让你看见湖心那座从未被标注的岛屿。',
        en: 'The fog of the World-Lake is not water; it is every word left unspoken. This fish parts it with its tail, revealing the island at the heart of the lake that no map has ever marked.',
      },
      {
        zh: '女巫们其实只是在跳舞。真正可怕的不是她们，而是你终于愿意看清自己心中的迷雾。',
        en: 'The witches were only dancing. What was truly frightening was that you finally agreed to see through the fog inside yourself.',
      },
    ],
  },
  {
    fishId: 'ita_bucentaur_fish',
    title: { zh: '金舟鱼：海婚之约', en: 'Bucentaur Fish: Marriage to the Sea' },
    fragments: [
      {
        zh: '威尼斯总督金舟的灵魂化作了这条鱼。它的鳞片是纯金叶子，鳍边镶嵌着代表海洋的蓝色珐琅。',
        en: 'The soul of the Doge’s golden barge became this fish. Its scales are pure gold leaf, its fins edged with blue enamel for the sea.',
      },
      {
        zh: '世界之湖记得每一次“与海联姻”的仪式。总督把戒指投入海中，而湖泊把戒指保存在最深的蚌壳里，等待下一个愿意承诺的人。',
        en: 'The World-Lake remembers every Marriage to the Sea. The Doge cast a ring into the water, and the lake keeps it in its deepest shell, waiting for the next one willing to promise.',
      },
      {
        zh: '你没有戒指可抛。但你每次收线，都像是在对湖泊说：我愿意继续来。而这已经足够。',
        en: 'You have no ring to cast. But every time you reel in, you tell the lake: I will return. And that is enough.',
      },
    ],
  },
  {
    fishId: 'dnk_little_mermaid_fish',
    title: { zh: '小美人鱼：未说之语', en: 'The Little Mermaid: The Unspoken Word' },
    fragments: [
      {
        zh: '它的鳞片上有泡沫的光泽，仿佛刚从童话的最后一页游出来。它保留了那条鱼尾，也保留了那句从未说出口的话。',
        en: 'Its scales gleam like sea-foam, as if it swam from the final page of a fairy tale. It kept its tail, and also the word it never spoke.',
      },
      {
        zh: '世界之湖收藏着所有未说之语。它们沉入水底，变成细小的珍珠。小美人鱼鱼的每一次呼吸，都会让其中一颗浮出水面。',
        en: 'The World-Lake collects every unspoken word. They sink and become tiny pearls. Each breath of the Little Mermaid Fish brings one back to the surface.',
      },
      {
        zh: '你钓起了一颗珍珠，却没有打开它。有些故事之所以珍贵，正是因为它们从未被完整地讲述。',
        en: 'You caught a pearl but did not open it. Some stories are precious precisely because they were never fully told.',
      },
    ],
  },
  {
    fishId: 'isl_odin_ray',
    title: { zh: '奥丁之眼：智慧之价', en: 'Óðins Auga: The Price of Wisdom' },
    fragments: [
      {
        zh: '奥丁在密米尔之泉献祭的右眼化作了这条鳐鱼。它的瞳孔深处藏着宇宙的一角智慧。',
        en: 'Odin’s sacrificed eye in Mímir’s well became this ray. Deep in its pupil lies a corner of the universe’s wisdom.',
      },
      {
        zh: '世界之湖就是另一口密米尔之泉。它不要求你献祭眼睛，只要求你献祭一点时间、一点耐心，和一点对未知的敬畏。',
        en: 'The World-Lake is another Mímir’s Well. It does not demand an eye; it only asks for a little time, a little patience, and a little awe for the unknown.',
      },
      {
        zh: '你当然没有因此看见未来。但你开始看见此刻：水面的纹路、风的走向、以及自己并不孤独。',
        en: 'You did not gain sight of the future. But you began to see the present: the pattern of the water, the direction of the wind, and that you are not alone.',
      },
    ],
  },
  {
    fishId: 'tha_royal_barge_fish',
    title: { zh: '御舟鱼：水上王者', en: 'Royal Barge Fish: Sovereign of the Waters' },
    fragments: [
      {
        zh: '它的鳞片如鎏金船首像，鳍如金箔船帆。传说中，制服它的人会被授予“水上王者”的短暂尊荣。',
        en: 'Its scales are like gilded figureheads, its fins like golden sails. Legend says whoever masters it is granted the brief title of Sovereign of the Waters.',
      },
      {
        zh: '但世界之湖没有王座。湖泊授予你的尊荣，只是一次安静漂流的许可——没有臣民，没有战争，只有你和水面。',
        en: 'But the World-Lake has no throne. The honor it grants is only permission to drift in silence — no subjects, no war, just you and the water.',
      },
      {
        zh: '真正的“水上王者”不是征服者，而是那个愿意一次次把线抛出去、却从不索取全部的人。',
        en: 'The true Sovereign of the Waters is not a conqueror, but the one who casts again and again without demanding everything.',
      },
    ],
  },
  {
    fishId: 'egy_aten_disc',
    title: { zh: '阿顿之轮：一神的专注', en: 'Aten Disc: The Focus of One' },
    fragments: [
      {
        zh: '阿肯那顿法老崇拜的太阳圆盘在水下变成了完美的圆形鳐鱼。它的边缘放射着光线的纹路，像一轮沉进水中的太阳。',
        en: 'Akhenaten’s sun disc became a perfect circular ray beneath the water. Rays of light pattern its edges like a sun sinking into the depths.',
      },
      {
        zh: '世界之湖也崇拜“一”——不是某一个神，而是每一次只专注于一件事的状态。阿顿之轮因此在水底静静旋转，从不分心。',
        en: 'The World-Lake also worships One — not a single god, but the state of giving one thing your full attention. Thus the Aten Disc turns quietly below, never distracted.',
      },
      {
        zh: '你盯着浮标的那一刻，湖泊也在盯着你。你们互相成了彼此唯一的神。',
        en: 'In the moment you watched the float, the lake watched you. You became each other’s only god.',
      },
    ],
  },
  {
    fishId: 'grc_atlantis_fish',
    title: { zh: '亚特兰蒂斯鱼：沉没之城', en: 'Atlantis Fish: The Sunken City' },
    fragments: [
      {
        zh: '沉没的亚特兰蒂斯大陆的最后一块碎片化作了这条鱼。它的鳞片上刻着失落的环状运河地图，鳍边有奥利哈刚的神秘光泽。',
        en: 'The last shard of sunken Atlantis became this fish. Its scales bear the map of the lost ringed canals, and its fins carry the mysterious sheen of orichalcum.',
      },
      {
        zh: '世界之湖接纳过许多沉没的东西：城市、文明、野心、遗憾。亚特兰蒂斯鱼是湖泊的档案管理员，负责记住所有消失的名字。',
        en: 'The World-Lake has received many sunken things: cities, civilizations, ambitions, regrets. The Atlantis Fish is the lake’s archivist, tasked with remembering every vanished name.',
      },
      {
        zh: '你不必找到亚特兰蒂斯。当你把这条鱼轻轻放回水中，你就已经把它归还给了所有沉没之城共同的故乡。',
        en: 'You need not find Atlantis. When you release this fish gently back into the water, you return it to the shared homeland of all sunken cities.',
      },
    ],
  },
];
