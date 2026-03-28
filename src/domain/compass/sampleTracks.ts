import type { CompassTrack } from './schema';

export const FISHING_TRACK: CompassTrack = {
    id: "fishing-track",
    name: "釣り",
    description: "身近な水辺から始めて、自分の装備で好きな魚を狙えるようになるまでの道のり。",
    levels: [
        {
            id: "level-1-pond",
            order: 1,
            name: "釣り堀で体験する",
            description: "まずは道具を借りて、魚を釣るという感覚を知る風景。",
            unlock_text: "初めての釣り堀体験を通じて、一つの風景を見渡しました。次のテーマを探りましょう。",
            requirements: [
                {
                    id: "req-1-buy",
                    label: "釣りに関する知見がある",
                    type: "asset_name",
                    expected: "釣り",
                    note: "「釣り」を名前に含む資産（知見・技能どちらでも可）"
                },
                {
                    id: "req-1-visit",
                    label: "体験に関する記録がある",
                    type: "scale_at_least",
                    expected: "小",
                    note: "知見カテゴリの資産が1つ以上"
                }
            ],
            missions: [
                {
                    id: "m-1-search",
                    label: "近所の釣り堀を検索する",
                    kind: "search",
                    summary: "Googleマップで「釣り堀」を検索。行けそうな場所を1つ見つける。15分で十分。",
                    related_requirement_ids: ["req-1-buy"]
                },
                {
                    id: "m-1-visit",
                    label: "釣り堀に行ってみる",
                    kind: "visit",
                    summary: "レンタル竿で1時間だけ。釣れなくてもOK。行ったこと自体が知見になる。",
                    related_requirement_ids: ["req-1-visit"]
                }
            ]
        },
        {
            id: "level-2-sabiki",
            order: 2,
            name: "海釣り公園でサビキ釣り",
            description: "自分の身近な海へ行き、簡単な仕掛けで小魚を狙う風景。",
            unlock_text: "海での釣りを経験し、新たな風を感じることができました。",
            requirements: [
                {
                    id: "req-2-item",
                    label: "釣り道具一式を用意する",
                    type: "asset_type",
                    expected: "物理資産",
                    note: "竿・リール・仕掛けなど"
                }
            ],
            missions: [
                {
                    id: "m-2-learn",
                    label: "サビキ釣りの動画を見る",
                    kind: "learn",
                    summary: "サビキ釣りのやり方や、必要な道具を動画で5分だけ確認する。",
                    related_requirement_ids: ["req-2-item"]
                },
                {
                    id: "m-2-buy",
                    label: "釣具屋で初心者セットを買う",
                    kind: "buy",
                    summary: "店員さんに「サビキ釣りをしたい」と言って、安いセットを買う。",
                    related_requirement_ids: ["req-2-item"]
                }
            ]
        }
    ]
};

export const CODING_TRACK: CompassTrack = {
    id: "coding-track",
    name: "プログラミング",
    description: "コードで自分の欲しいツールを作り出す道のり。",
    levels: [
        {
            id: "level-1-hello",
            order: 1,
            name: "環境を整えてHello World",
            description: "まずはエディタを立ち上げて文字を表示させる風景。",
            unlock_text: "初めてのコードが動きました。新たな世界への第一歩です。",
            requirements: [
                {
                    id: "req-code-1",
                    label: "エディタの導入",
                    type: "asset_name",
                    expected: "VSCode"
                }
            ],
            missions: [
                {
                    id: "m-code-1",
                    label: "VSCodeをインストール",
                    kind: "setup",
                    summary: "公式サイトからダウンロードしてインストールするだけ。",
                    related_requirement_ids: ["req-code-1"]
                }
            ]
        }
    ]
};

export const SAMPLE_TRACKS: CompassTrack[] = [
    FISHING_TRACK,
    CODING_TRACK
];
