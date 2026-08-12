/**
 * DIY v2 IA：
 * 一级：三大类入口（真人/宠物/玩具）
 * 二级：首位突出「复刻」+ 变身风格瀑布流
 * 三级：上传制作
 */

/** @typedef {{ n: string, name: string, file: string, id: string, h: number, stylize: boolean, inputNote?: string, fit?: 'cover' | 'contain' }} HubTemplate */

/** @type {{ id: string, name: string, tag: string, blurb: string, replicaBlurb: string, cover: string, cta: string, templates: HubTemplate[] }[]} */
export const HUBS = [
  {
    id: 'person',
    name: '真人全息动态',
    tag: '真人',
    blurb: '复刻原貌，或一键变身',
    replicaBlurb: '白底轻轻落一影，原模原样还是你，先不玩变身哦',
    cover: 'hub-banner-person.png',
    cta: '玩一下',
    templates: [
      {
        n: '00',
        name: '真人复刻',
        file: 'diy-realtime-person-clean.png',
        id: 'tpl_00_realtime',
        h: 228,
        stylize: false,
        inputNote: '真人清晰照片；无风格化，白底单影复刻',
      },
      { n: '01', name: '变身棉花娃娃', file: 'tpl-20-yarn-doll.png', id: 'tpl_18_yarn_doll', h: 236, stylize: true },
      {
        n: '02',
        name: '变身机甲',
        file: 'tpl-23-person-mecha.png',
        id: 'tpl_23_person_mecha',
        h: 252,
        stylize: true,
        inputNote: '真人照片；写实机甲战甲穿在真人身上，保留五官身份',
      },
      {
        n: '03',
        name: '变身bjd学院风证件照',
        file: 'tpl-22-bjd-school-id.png',
        id: 'tpl_20_bjd_school_id',
        h: 252,
        stylize: true,
      },
      {
        n: '04',
        name: '变身bjd高定爱豆',
        file: 'tpl-21-bjd-idol.png',
        id: 'tpl_19_bjd_idol',
        h: 252,
        stylize: true,
      },
      { n: '05', name: '变身乐高角色', file: 'tpl-10-pixel.png', id: 'tpl_08_pixel', h: 256, stylize: true },
      { n: '06', name: '变身自拍盲盒', file: 'tpl-05-blindbox.png', id: 'tpl_04_selfie_blindbox', h: 256, stylize: true },
      { n: '07', name: '变身打工人盲盒', file: 'tpl-16-office.png', id: 'tpl_05_office_blindbox', h: 256, stylize: true },
      { n: '08', name: '变身RPG角色', file: 'tpl-11-rpg.png', id: 'tpl_02_rpg', h: 256, stylize: true },
      { n: '09', name: '变身咖啡店打卡', file: 'tpl-19-cafe.png', id: 'tpl_03_cafe', h: 244, stylize: true },
      { n: '10', name: '变身立体全家福', file: 'tpl-01-family.png', id: 'tpl_15_family', h: 236, stylize: true },
      { n: '11', name: '变身婚礼微雕塑', file: 'tpl-13-wedding.png', id: 'tpl_17_wedding', h: 236, stylize: true },
    ],
  },
  {
    id: 'pet',
    name: '宠物全息动态',
    tag: '宠物',
    blurb: '萌宠复刻与风格变身',
    replicaBlurb: '白底轻轻落一影，毛孩子本色出镜，先不玩变身哦',
    cover: 'hub-banner-pet.png',
    cta: '玩一下',
    templates: [
      {
        n: '00',
        name: '宠物复刻',
        file: 'diy-realtime-pet-clean.png',
        id: 'tpl_00_pet_realtime',
        h: 228,
        stylize: false,
        inputNote: '真实宠物照片；无风格化，白底单影复刻',
      },
      { n: '01', name: '粘土宠物', file: 'tpl-03-clay-dog.png', id: 'tpl_12_clay_dog', h: 248, stylize: true, fit: 'cover' },
      { n: '02', name: '羊毛毡宠物', file: 'tpl-04-felt-cat.png', id: 'tpl_13_felt_cat', h: 248, stylize: true, fit: 'cover' },
    ],
  },
  {
    id: 'toy',
    name: '玩具全息动态',
    tag: '玩具',
    blurb: '物件动态，一键全息',
    replicaBlurb: '白底轻轻落一影，宝贝原貌稳出镜，先不玩变身哦',
    cover: 'hub-banner-toy.png',
    cta: '玩一下',
    templates: [
      {
        n: '00',
        name: '玩具复刻',
        file: 'diy-realtime-toy-clean.png',
        id: 'tpl_00_toy_realtime',
        h: 228,
        stylize: false,
        inputNote: '玩具/载具/物件清晰照片；无风格化，白底单影复刻',
      },
      {
        n: '01',
        name: 'Q版机甲',
        file: 'tpl-17-mecha.png',
        id: 'tpl_01_mecha',
        h: 256,
        stylize: true,
        fit: 'contain',
        inputNote: '玩具/角色照；Q版机甲收藏手办风',
      },
      {
        n: '02',
        name: '微缩载具',
        file: 'tpl-12-vehicle-full.png',
        id: 'tpl_07_vehicle',
        h: 148,
        stylize: true,
        fit: 'contain',
        inputNote: '载具/物件照；微缩模型全貌展示',
      },
      {
        n: '03',
        name: '数字国潮摆件',
        file: 'tpl-06-guochao.png',
        id: 'tpl_09_guochao',
        h: 236,
        stylize: true,
        fit: 'contain',
      },
      {
        n: '04',
        name: '桌面盆栽',
        file: 'tpl-09-season.png',
        id: 'tpl_14_plant',
        h: 212,
        stylize: true,
        fit: 'contain',
      },
    ],
  },
];

export function allTemplates() {
  return HUBS.flatMap((h) => h.templates.map((t) => ({ ...t, hub: h.id, hubName: h.name, cat: h.tag })));
}

export function replicaOf(hub) {
  return hub.templates.find((t) => t.stylize === false) || hub.templates[0];
}

export function stylizeOf(hub) {
  return hub.templates.filter((t) => t.stylize !== false);
}
