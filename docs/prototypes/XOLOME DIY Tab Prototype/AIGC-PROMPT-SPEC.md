# DIY 首页入口 · AIGC 提示词规格（交付 AIGC / 研发）

> 工程包：`XOLOME DIY Tab Prototype/`（workspace 根；另见 `TAGS.md` / `FEATURES.md`）  
> 对应原型首页入口：`真人全息动态` + 17 个风格模板。  
> 用途：AIGC 工程师编写/调优提示词；研发按 `template_id` / `play_id` 对接生成链路。  
> 飞书表格：https://ycn4bd3jvyxg.feishu.cn/wiki/VKxpwEsEQihXAbkm4OZctUg4nDe  
> 机器可读：同目录 `aigc-templates.json`  
> 标签：`全部 / 真人 / 宠物 / 潮玩 / 游戏 / 桌宠 / 真人雕塑`（原「家人」「纪念」已并入「真人雕塑」）

---

## 1. 总览与约定

### 1.1 生成链路（两步必须衔接）

1. 用户选入口（真人全息动态 / 某风格模板）
2. 上传真实照片
3. **步骤 A · 图片 AIGC（图生图）**：生成风格化（或真人还原）**首帧**  
   → 必须一次性写死光影：`正面打光` + `身后仅一道投影`
4. 选择 **视频玩法**
5. **步骤 B · 视频 AIGC（图生视频）**：以**首帧为条件图** + 完整 `video_prompt` 生成短视频  
   → 必须继承步骤 A 的光影，且**影子随主体而动**，不新增第二道光/影
6. 作品详情 → 投放全息舱

> **衔接原则**：步骤 B 禁止重新布光；一切光影以步骤 A 首帧为准。`video_prompt` 内动作段只描述姿态变化，不描述改光源。

### 1.2 ID 约定

| 字段 | 说明 | 示例 |
|------|------|------|
| `template_id` | 入口 ID | `tpl_00_realtime` / `tpl_12_clay_dog` |
| `cat` | 首页标签 | 真人 / 宠物 / 潮玩 / 游戏 / 桌宠 / **真人雕塑** |
| `play_id` | 玩法 ID | `play_wave` / `play_dance` |
| `image_prompt` | 步骤 A 图生图提示词 | 见各模板 + 光影硬约束 |
| `video_prompt` | 步骤 B **完整**图生视频提示词（构图约束+动作+光影继承，一条） | 见各玩法 |

### 1.3 光影硬约束（全模板共用 · 必读）

#### 步骤 A · 生图（写入每条 `image_prompt` 末尾）

**中文（交付用）：**
```
【光影硬约束】正面打光（主光自镜头方向照向主体），柔和均匀；身后地面/背景仅有一道投影（单影）。禁止多光源、侧顶强光、脚下多重阴影、交叉阴影。
```

**English：**
```
Front key light from camera direction (frontal lighting), soft and even. Exactly one cast shadow behind the subject on the floor/backdrop. No multi-light setup, no strong side/rim lights, no multiple shadows.
```

#### 步骤 B · 图生视频（整段写入 `video_prompt`，不再拆通用词/动作词）

每条视频提示词 = **构图与机位约束** + **本玩法动作** + **光影继承硬约束**，交付时只给 AIGC **一列/一个字段**。

**中文结构（飞书「视频AIGC提示词」）：**
```
画面中央，全身不出框，固定机位，一镜到底，…约4-5秒。
【光影继承·硬约束】严格继承首帧：…投影须随主体动作自然位移与形变。…
{本玩法动作描述}
```

#### 验收要点

| 检查项 | 步骤 A | 步骤 B |
|--------|--------|--------|
| 正面打光 | 必须 | 必须保持 |
| 身后单影 | 必须只有一道 | 仍只有一道，且随主体移动 |
| 光源方向/强度 | 固定 | 禁止改变 |
| 多光源/侧光/多重影 | 禁止 | 禁止 |

### 1.4 其他通用约束

**图片侧还必须：**
- 保留上传主体的可识别特征（人脸/宠物体色花纹/服饰关键色等）
- 竖版构图（推荐 9:16），主体完整入镜
- 干净背景，避免杂乱文字水印
- 单主体清晰、边缘干净，便于步骤 B 动态

**视频侧还必须：**
- 以选定首帧为条件，短动态（建议 3–5 秒）
- 动作幅度适中，避免剧烈形变导致身份崩坏
- 镜头相对固定，主体始终在画面中心区域

**真人全息动态特例：**
- **不做风格化**，保持真人照片质感与身份一致
- 仍遵守正面打光 + 身后单影；视频阶段影子随动作移动

---

## 2. 入口清单

> **展示序 `#`** 按标签成组；**`template_id` 稳定**。Chip：`全部 / 潮玩 / 游戏 / 宠物 / 桌宠 / 真人雕塑 / 真人`。

| # | template_id | 名称 | cat | 输入期望 | 输出期望 |
|---|-------------|------|-----|----------|----------|
| 00 | tpl_00_realtime | 真人全息动态 | 真人 | 真人清晰照片 | 同人真实质感动态（一键变成动态） |
| 01 | tpl_18_yarn_doll | 棉花娃娃 | 潮玩 | 人物照 | 棉花/毛线质感娃娃 |
| 02 | tpl_01_mecha | **Q版机甲** | 游戏 | 人物/角色照 | Q版机甲立绘 |
| 03 | tpl_08_pixel | **乐高角色** | 游戏 | 人物照 | LEGO / BrickHeadz 积木人 |
| 04 | tpl_04_selfie_blindbox | 自拍盲盒 | 潮玩 | **自拍（可半身）** | AI 补全身 → 手持手机潮玩盲盒娃 |
| 05 | tpl_05_office_blindbox | 打工人盲盒 | 潮玩 | 人物照 | 办公室潮玩盲盒 |
| 06 | tpl_20_bjd_school_id | **bjd学院风证件照** | 潮玩 | **正脸自拍** | 只保留脸 + 学院风 BJD 模板身 |
| 07 | tpl_19_bjd_idol | **bjd高定爱豆** | 潮玩 | 真实人物照 | BJD 高定爱豆造型娃娃 |
| 08 | tpl_02_rpg | RPG立绘立体化 | 游戏 | 人物照 | RPG 立体立绘角色 |
| 09 | tpl_06_soda | 汽水瓶人偶 | 潮玩 | 人物照 | 汽水瓶 IP 人偶 |
| 10 | tpl_07_vehicle | 微缩载具 | 潮玩 | 载具/人物+载具 | 微缩载具模型 |
| 11 | tpl_12_clay_dog | 粘土小狗 | 宠物 | **真实小狗照片** | 粘土质感小狗 |
| 12 | tpl_13_felt_cat | 羊毛毡小猫 | 宠物 | **真实小猫照片** | 羊毛毡质感小猫 |
| 13 | tpl_09_guochao | 数字国潮摆件 | 桌宠 | 人物/宠物/物件 | 国潮神兽/摆件风 |
| 14 | tpl_10_sprite | 桌面小精灵 | 桌宠 | 人物/宠物 | 桌面陪伴小精灵 |
| 15 | tpl_11_weather | 天气精灵 | 桌宠 | 人物/宠物 | 天气主题精灵 |
| 16 | tpl_14_plant | 桌面盆栽 | 桌宠 | 植物/人物 | 桌面盆栽微缩 |
| 17 | tpl_03_cafe | 咖啡店打卡 | **真人雕塑** | 人物照 | 咖啡店微缩打卡场景 |
| 18 | tpl_15_family | 立体全家福 | **真人雕塑** | 全家福/多人合影 | 立体全家福雕塑 |
| 19 | tpl_17_wedding | 微雕塑婚礼瞬间 | **真人雕塑** | 婚礼/情侣照 | 婚礼微雕塑 |

---

## 3. 分模板规格（图片提示词 + 视频玩法）

> 下列草案均应 **拼接 §1.3 光影硬约束**（`aigc-templates.json` 已内嵌英文版）。  
> `{subject}` = 用户上传照片中的主体描述 / 参考图。  
> 完整中文版以飞书表「图片AIGC提示词 / 视频AIGC提示词」为准（视频为合并后的单列）。

---

### 00 · 真人全息动态 · `tpl_00_realtime`

**步骤 A · 图片 AIGC（无风格化）**
- **目标**：身份与真实感不变；一次性写死正面打光 + 身后单影，供步骤 B 继承
- **image_prompt（草案，须含 §1.3 光影）**：
  ```
  Keep the exact real-person identity from the reference photo. Photorealistic, natural skin and clothing, clean studio, full subject in frame, 9:16 vertical, ready for hologram display. No stylization. Front key light from camera direction (frontal lighting), soft and even. Exactly one cast shadow behind the subject. No multi-light / multiple shadows.
  ```
- **负向要点**：二次元、粘土、羊毛毡、盲盒、机甲、像素、过度美颜、换脸、额外人物、多光源、多重影

**步骤 B · 视频玩法备选（须含光影继承）**

| play_id | 玩法名 | video_prompt（完整草案） |
|---------|--------|------------------------|
| play_wave | 挥手打招呼 | Same real person, gentle friendly wave toward camera, natural smile, subtle body sway, photorealistic, 4s + §1.3 video lighting inherit |
| play_turn | 原地轻轻转圈 | Same real person, slow small turn in place then face camera, keep identity, photorealistic, 4s + §1.3 video lighting inherit |
| play_cheer | 开心挥手庆祝 | Same real person, cheerful small celebration gesture with hands, slight bounce, photorealistic, 4s + §1.3 video lighting inherit |

---

### 01 · Q版机甲 · `tpl_01_mecha`

**图片 AIGC**
- **目标**：把用户照片主体变成 **Q版机甲**，保留发型/配色/五官暗示
- **image_prompt（草案）**：
  ```
  Transform {subject} into a chibi Q-version mecha robot figure. Cute SD proportions, white/teal/lime armor accents, clean product render on white background, collectible toy look, sharp edges, soft studio shadow, 9:16.
  ```

**视频玩法备选**

| play_id | 玩法名 | video_prompt（草案） |
|---------|--------|------------------------|
| play_charge | 机甲出击 | Chibi mecha steps forward and raises weapon, energetic but stable, keep design, 4s |
| play_guard | 防御姿态 | Chibi mecha lifts shield into guard pose, slight stance shift, 4s |
| play_powerup | 能量蓄力 | Chibi mecha charges energy glow on chest/eyes, idle power-up animation, 4s |

---

### 02 · RPG立绘立体化 · `tpl_02_rpg`

**图片 AIGC**
```
Transform {subject} into a 3D RPG character standee / figure illustration. Fantasy adventure outfit, heroic pose, detailed but clean, white or soft gradient backdrop, collectible render, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_draw | 拔剑亮相 | RPG figure draws weapon and settles into battle stance, 4s |
| play_cast | 施法吟唱 | RPG figure casts a soft spell with glowing hands, 4s |
| play_victory | 胜利姿势 | RPG figure victory pose, slight cheer, 4s |

---

### 03 · 咖啡店打卡 · `tpl_03_cafe`

**图片 AIGC**
```
Transform {subject} into a miniature cafe check-in diorama figure. Cozy coffee shop props (cup, table, small plant), warm soft light, cute desktop collectible, clean background, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_cheers | 举杯 cheers | Cafe figure lifts coffee cup for a cheers toward camera, 4s |
| play_sip | 慢慢喝一口 | Cafe figure gently sips from the cup, cozy mood, 4s |
| play_checkin | 挥手打卡 | Cafe figure waves as if checking in for a photo, 4s |

---

### 02 · 自拍盲盒 · `tpl_04_selfie_blindbox` · cat=`潮玩`（展示序 #04）

**输入**：用户自拍图即可（允许半身/大头，**不必全身照**）。

**图片 AIGC**
```
User upload is a selfie and may be face-only or half-body (not a full-body photo). First invent a coherent full-body casual street look that matches the selfie identity, then transform into a trendy blind-box vinyl doll (Pop Mart–like collectible / 自拍盲盒). Soft 3D designer-toy proportions (slightly larger head, smooth plastic skin), glossy vinyl finish. Standing full-body facing camera, holding a smartphone at chest height in one hand as if checking a selfie, other arm relaxed. Casual outfit vibe matching the template cover: oversized cream sweatshirt over a white tee, blue jeans with rolled cuffs, clean white sneakers, small bright crossbody bag. Soft smile, large sparkling eyes, keep recognizable face/hairstyle/clothing color cues from the selfie. Pure white studio backdrop, full figure in frame, product shot, 9:16. Do not crop to bust only.
```

封面：`covers-v2/tpl-05-blindbox.png`

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_check | 看手机自拍 | Selfie blind-box vinyl doll glances at the phone screen then smiles toward camera, slight phone tilt, keep casual street outfit and toy look, 4s |
| play_peace | 比耶自拍 | Selfie blind-box vinyl doll raises a peace sign beside the phone for a cute selfie pose, 4s |
| play_spin | 转圈展示 | Selfie blind-box vinyl doll does a small spin to show sweatshirt, jeans and crossbody bag, then faces camera with phone still in hand, 4s |

---

### 05 · 打工人盲盒 · `tpl_05_office_blindbox`

**图片 AIGC**
```
Transform {subject} into an office-worker blind-box figure. Business casual, desk/laptop vibe props optional, vinyl toy material, clean white backdrop, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_type | 敲键盘加班 | Office blind-box figure types on a tiny laptop, 4s |
| play_stretch | 伸个懒腰 | Office blind-box figure stretches arms after work, 4s |
| play_coffee | 摸鱼喝咖啡 | Office blind-box figure sneaky coffee break sip, 4s |

---

### 06 · 汽水瓶人偶 · `tpl_06_soda`

**图片 AIGC**
```
Transform {subject} into a soda-bottle mascot figure. Bottle silhouette + cute character face/body, glossy plastic, brand-less generic soda colors, product render, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_fizz | 开盖冒泡 | Soda mascot pops cap with fizz bubbles, playful, 4s |
| play_dance | 瓶身摇摆舞 | Soda mascot sways/dances side to side, 4s |
| play_toast | 举瓶干杯 | Soda mascot raises bottle for a toast, 4s |

---

### 07 · 微缩载具 · `tpl_07_vehicle`

**图片 AIGC**
```
Transform reference into a miniature vehicle collectible (match vehicle type if present; otherwise cute personal mini car/scooter themed to subject colors). Die-cast / model kit look, clean backdrop, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_start | 启动加速 | Mini vehicle starts and rolls forward slightly, 4s |
| play_drift | 小漂移 | Mini vehicle does a tiny drift turn, 4s |
| play_lights | 亮灯鸣笛 | Mini vehicle lights blink and subtle horn motion, 4s |

---

### 08 · 乐高角色 · `tpl_08_pixel` · cat=`游戏`（展示序 #03）

**图片 AIGC**
```
Transform {subject} into a LEGO / BrickHeadz-style collectible minifigure character (乐高角色). Oversized square blocky head with rounded brick edges, glossy ABS plastic toy finish, stud-and-brick construction look. Keep recognizable identity cues (hair/helmet colors, outfit colors, facial vibe) mapped onto brick parts. Standing full-body three-quarter or front product pose on pure white studio backdrop, soft single ground shadow, premium toy render, 9:16. Not voxel pixel-art, not clay, not vinyl blind-box. No watermark, no text.
```

封面：`covers-v2/tpl-10-pixel.png`（文件名沿用；内容为乐高角色）

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_walk | 积木行走 | LEGO BrickHeadz-style figure walks in place with blocky limb motion, keep glossy plastic brick look, 4s |
| play_jump | 积木跳跃 | LEGO BrickHeadz-style figure hops up and lands solidly, brick parts stay assembled, 4s |
| play_attack | 英雄出击 | LEGO BrickHeadz-style hero figure steps forward into a power pose / light punch, cape or torso bricks shift slightly, 4s |

---

### 09 · 数字国潮摆件 · `tpl_09_guochao`

**图片 AIGC**
```
Transform {subject} cues into a digital Guochao ornament / mythical guardian figure (auspicious beast motif inspired by subject colors). Jade, gold, lacquer accents, premium desktop ornament render, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_nod | 祥瑞点头 | Guochao ornament nods once auspiciously, 4s |
| play_glow | 纹样发光 | Patterns/eyes glow softly then settle, 4s |
| play_guard | 守护姿态 | Ornament shifts into a guardian stance, 4s |

---

### 10 · 桌面小精灵 · `tpl_10_sprite`

**图片 AIGC**
```
Transform {subject} into a cute desktop companion sprite/robot pet. Soft rounded forms, friendly face screen or eyes, brand green accents optional, clean white desk product shot, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_hi | 蹦跳问好 | Desktop sprite bounces and waves hello, 4s |
| play_bye | 挥手道别 | Desktop sprite waves goodbye, 4s |
| play_sit | 坐下陪伴 | Desktop sprite sits patiently companion-like, 4s |

---

### 11 · 天气精灵 · `tpl_11_weather`

**图片 AIGC**
```
Transform {subject} into a weather spirit companion figure (sun/cloud/rain motifs). Soft toy-like or resin figure, cheerful, clean backdrop, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_sunny | 晴天微笑 | Weather spirit sunny smile, light sparkle, 4s |
| play_rain | 下雨打伞 | Weather spirit opens tiny umbrella in soft rain, 4s |
| play_wind | 刮风旋转 | Weather spirit spins gently in wind, 4s |

---

### 12 · 粘土小狗 · `tpl_12_clay_dog`

**图片 AIGC（重点）**
- **输入**：用户真实小狗照片  
- **输出**：同犬只特征的 **粘土质感** 小狗摆件  
- **image_prompt（草案）**：
  ```
  Transform the real dog in the reference photo into a handmade polymer-clay dog figurine. Preserve breed, fur color pattern, ear shape and face markings. Soft clay material, fingerprint-friendly sculpt, cute big eyes, clean white background, product photography, 9:16. No photoreal fur.
  ```

**视频玩法备选**

| play_id | 玩法名 | video_prompt（草案） |
|---------|--------|------------------------|
| play_dance | 小狗跳舞 | Clay dog figurine does a cute little dance in place, keep clay look and markings, 4s |
| play_jump | 小狗跳高 | Clay dog figurine makes a small happy jump and lands, 4s |
| play_hello | 小狗打招呼 | Clay dog figurine sits and paws/waves hello toward camera, 4s |

---

### 13 · 羊毛毡小猫 · `tpl_13_felt_cat`

**图片 AIGC**
```
Transform the real cat in the reference photo into a needle-felted wool cat figurine. Preserve fur colors, markings, ear shape. Soft wool fiber texture, handmade craft look, clean backdrop, 9:16. No photoreal fur.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_stretch | 小猫伸懒腰 | Felt cat stretches lazily, soft wool look preserved, 4s |
| play_paw | 小猫扑爪 | Felt cat does a playful paw swipe, 4s |
| play_nuzzle | 小猫蹭头 | Felt cat nuzzles / head-rubs cute greeting, 4s |

---

### 14 · 桌面盆栽 · `tpl_14_plant`

**图片 AIGC**
```
Create a miniature desktop potted plant collectible inspired by {subject} colors/mood. Ceramic pot, healthy leaves, soft daylight, clean backdrop, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_sway | 叶子摇摆 | Plant leaves sway gently in breeze, 4s |
| play_bloom | 开花绽放 | A small bloom opens on the plant, 4s |
| play_grow | 浇水生长 | Subtle growth bounce after watering sparkle, 4s |

---

### 17 · 立体全家福 · `tpl_15_family` · cat=`真人雕塑`（展示序 #17）

**步骤 A · 图片 AIGC**
```
Transform the family/group in the reference photo into a 3D family portrait figurine set. Preserve relative ages, hairstyles, clothing colors. Clean white backdrop, collectible sculpture, 9:16. + §1.3 image lighting
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_wave_all | 全家挥手 | Family figurines wave together toward camera, 4s + §1.3 video lighting inherit |
| play_hug | 温暖拥抱 | Family figurines lean into a gentle group hug, 4s + §1.3 video lighting inherit |
| play_heart | 比心庆祝 | Family figurines make heart / celebration gestures, 4s + §1.3 video lighting inherit |

---

### 18 · 微雕塑婚礼瞬间 · `tpl_17_wedding` · cat=`真人雕塑`（展示序 #18）

**图片 AIGC**
```
Transform wedding/couple reference into a miniature wedding moment sculpture. Preserve outfits and identities, romantic soft light, clean backdrop, premium collectible, 9:16.
```

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_ring | 交换戒指 | Couple figurines exchange rings gesture, 4s |
| play_embrace | 拥抱瞬间 | Couple figurines embrace gently, 4s |
| play_dance | 新婚舞步 | Couple figurines do a small wedding sway dance, 4s |

---

### 01 · 棉花娃娃 · `tpl_18_yarn_doll` · cat=`潮玩`（展示序 #01）

**图片 AIGC**
```
Transform {subject} into a handmade cotton doll / knitted amigurumi plush doll (棉花娃娃). Soft looped yarn hair, round knit face with tiny black bead eyes, tiny stitched smile, soft blush. Knitted cardigan and overalls with clear stitch texture, tiny knitted booties. Chibi plush proportions, tactile yarn throughout, clean white studio background, collectible toy product photo, 9:16. Keep recognizable identity cues. No watermark, no text.
```

封面：`covers-v2/tpl-20-yarn-doll.png`（用户参考：`options/chaowan-previews/ref-yarn-doll-user.png`）  
曾用名：毛线娃娃

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_wave | 挥手问好 | Yarn doll waves hello toward camera, soft bounce, 4s |
| play_spin | 转圈展示 | Yarn doll small turn to show outfit then faces camera, 4s |
| play_hop | 开心蹦跳 | Yarn doll cute small hop then soft land, 4s |

---

### 06 · bjd高定爱豆 · `tpl_19_bjd_idol` · cat=`潮玩`（展示序 #07）

**输入**：用户真实人物照片 → BJD 高定爱豆造型。

**图片 AIGC**
```
Transform the real person in the reference photo into a high-end ball-jointed doll (BJD) in haute-couture idol style (bjd高定爱豆). Porcelain-smooth resin doll skin, large expressive BJD eyes with refined makeup, delicate doll facial proportions while keeping recognizable identity cues (face shape, hair color mapping). Slender BJD body. High-fashion all-black idol stage outfit vibe: cropped leather jacket, fitted leather pants with silver zip details, chain belt, sheer mesh overskirt, knee-high boots (adapt colors/details to subject when needed but keep premium idol couture feeling). Full body product render on clean off-white studio background, collectible doll photography, 9:16. No watermark, no text.
```

封面：`covers-v2/tpl-21-bjd-idol.png`（须为真 PNG；参考 `options/ref-bjd-idol-user.jpg`）

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_pose | 爱豆定格pose | BJD haute-couture idol doll (bjd高定爱豆) strikes a sharp fashion pose, slight hair sway, 4s |
| play_turn | 转圈展示高定 | BJD haute-couture idol doll (bjd高定爱豆) slow elegant turn then faces camera, 4s |
| play_wave | 舞台挥手 | BJD haute-couture idol doll (bjd高定爱豆) graceful idol stage wave and soft smile, 4s |

---

### 07 · bjd学院风证件照 · `tpl_20_bjd_school_id` · cat=`潮玩`（展示序 #06）

**输入**：仅正脸自拍。  
**规则**：生图**只保留用户脸**；身体/校服/发型模板身与参考图一致（浅灰西装外套、白衬衫、深灰百褶裙、乐福鞋、正面站立证件照）。

**图片 AIGC**
```
User provides a front-facing face selfie only. Extract and keep ONLY the user's face identity (eyes, brows, nose, mouth, face shape). Discard user's body, clothes, background, and hair length if conflicting. Place that face onto the exact academy-style BJD doll body from the template reference: porcelain BJD skin, large glass-like doll eyes adapted to user iris color, short neat dark brown bob (template hair), light gray tailored blazer, white collared shirt, charcoal pleated tennis skirt, black loafers, straight standing ID-photo pose, arms at sides, facing camera. Match the template body proportions, outfit, and composition exactly — same academy BJD ID look as the reference. Clean pure white studio backdrop, full body in frame, 9:16 vertical ID / product photo. No watermark, no text.
```

封面：`covers-v2/tpl-22-bjd-school-id.png`

| play_id | 玩法名 | video_prompt |
|---------|--------|---------------|
| play_blink | 证件照眨眼 | Academy BJD ID doll soft blink, hold formal pose, 4s |
| play_smile | 浅浅微笑 | Academy BJD ID doll subtle polite smile then neutral, 4s |
| play_nod | 轻轻点头 | Academy BJD ID doll small formal nod then face camera, 4s |

---

## 4. 研发对接建议

### 4.1 接口字段（建议）

```json
{
  "template_id": "tpl_12_clay_dog",
  "image_job": {
    "prompt_key": "tpl_12_clay_dog.image",
    "ref_image": "<user_upload>",
    "aspect": "9:16"
  },
  "play_id": "play_dance",
  "video_job": {
    "prompt_key": "tpl_12_clay_dog.play_dance",
    "first_frame": "<selected_frame>",
    "duration_sec": 4
  }
}
```

### 4.2 配置表

- 建议以 JSON/远程配置维护：`templates[]` → `image_prompt` + `plays[].video_prompt` + 顶层 `lighting`
- 前端玩法 Sheet 按 `template_id` 拉取 3 个备选
- 首页标签 `cat` 仅用于筛选：`全部 / 潮玩 / 游戏 / 宠物 / 桌宠 / 真人雕塑 / 真人`
- 步骤 B 必须传入步骤 A 的首帧；`video_prompt` 已是完整一条，勿再拆通用词/动作词

### 4.3 验收清单（AIGC）

- [ ] 身份/花纹/关键色可识别保留  
- [ ] 风格与模板封面一致（粘土/羊毛毡/盲盒/机甲等）  
- [ ] 真人模板无风格化漂移  
- [ ] **步骤 A：正面打光 + 身后仅一道影**  
- [ ] **步骤 B：光影继承，影子随主体动，无第二光源/第二影**  
- [ ] 每个玩法动作可读、4s 内完成、不崩模  
- [ ] 竖版构图适合全息舱投放  

---

## 5. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-10 | 首版：按 DIY 首页 18 入口列出图片提示词规格 + 每模板 3 个视频玩法备选 |
| 2026-08-10 | 「家人」并入「纪念」并更名为「真人雕塑」；补齐生图/图生视频光影硬约束与两步衔接 |
| 2026-08-10 | 视频「通用词+动作提示词」合并为单列 `视频AIGC提示词` / `video_prompt` |
| 2026-08-10 | 废弃旧潮玩 A/B 预览图；上线 **毛线娃娃** `tpl_18_yarn_doll`（封面 `tpl-20-yarn-doll.png`） |
| 2026-08-10 | **棉花娃娃**置顶为展示序 #01；瀑布流按标签成组重编号；Chip 改为潮玩优先；统一命名「棉花娃娃」（id 仍为 `tpl_18_yarn_doll`） |
| 2026-08-10 | 通栏文案改为「一键变成动态」；删除毕业照雕塑；自拍盲盒改为自拍补全身；新增潮玩 **bjd娃** `tpl_19_bjd_idol`；飞书提示词全量对齐 |
| 2026-08-10 | 修复 bjd 封面（JPEG 误存为 .png 导致卡片 1px 宽）；更名为 **bjd高定爱豆**；`imageAspect` 兼容 JPEG |
| 2026-08-10 | 新增 **bjd学院风证件照** `tpl_20_bjd_school_id`：正脸自拍只换脸，身体用学院风 BJD 模板；潮玩×7；飞书对齐 |
| 2026-08-10 | **自拍盲盒**换新封面（手持手机卫衣牛仔潮玩娃）并对齐提示词/玩法；飞书与 Figma 同步 |
| 2026-08-10 | **像素角色**更名为 **乐高角色**（封面 BrickHeadz 风；`tpl_08_pixel` id 不变）；飞书与 Figma 全量对齐 |
| 2026-08-10 | 瀑布流重排：01棉花娃娃 → 02机甲 → 03乐高 → 04自拍盲盒 → 05打工人 → 06学院风BJD → 07高定爱豆；飞书序号对齐 |
