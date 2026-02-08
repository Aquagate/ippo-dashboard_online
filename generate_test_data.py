
import csv
import random
from datetime import datetime, timedelta

def generate_csv(filename="test_data_1month.csv"):
    categories = [
        "【仕事・企画】", "【技術・開発】", "【学び・勉強】", 
        "【健康・身体】", "【家族・子ども】", "【趣味・遊び】"
    ]
    activities = {
        "【仕事・企画】": ["プロジェクト計画作成", "チーム定例MTG", "資料作成", "クライアント提案", "メール返信"],
        "【技術・開発】": ["リファクタリング", "バグ修正", "新機能実装", "コードレビュー", "ドキュメント更新"],
        "【学び・勉強】": ["技術書読書", "オンライン講座", "Qiita記事執筆", "ニュースチェック"],
        "【健康・身体】": ["筋トレ", "ジョギング", "昼寝", "サプリ摂取", "ストレッチ"],
        "【家族・子ども】": ["子供と遊ぶ", "買い物", "料理", "掃除", "家族会議"],
        "【趣味・遊び】": ["ゲーム", "映画鑑賞", "漫画", "散歩", "カフェ"]
    }

    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    entries = []

    current_date = start_date
    while current_date <= end_date:
        # 1日 3〜7件
        daily_count = random.randint(3, 7)
        for _ in range(daily_count):
            cat = random.choice(categories)
            act = random.choice(activities[cat])
            text = f"{act}を実施。次のステップへ。"
            
            # 9:00 - 23:00
            hour = random.randint(9, 23)
            minute = random.randint(0, 59)
            
            ts = current_date.replace(hour=hour, minute=minute)
            
            # format: YYYY/MM/DD, Text, YYYY/MM/DD HH:MM
            date_str = ts.strftime("%Y/%m/%d")
            time_str = ts.strftime("%Y/%m/%d %H:%M")
            
            entries.append([date_str, text, time_str])
        
        current_date += timedelta(days=1)
    
    # Sort just in case? No, parseIppoCsv handles it. But let's sort by date asc
    entries.sort(key=lambda x: x[2])

    with open(filename, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["日付", "内容", "記録日時"]) # Header
        writer.writerows(entries)

    print(f"Generated {len(entries)} entries in {filename}")

if __name__ == "__main__":
    generate_csv()
