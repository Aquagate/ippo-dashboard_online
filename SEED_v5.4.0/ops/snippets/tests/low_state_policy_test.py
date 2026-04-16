"""
Low-state policy boundary test template.

Target rule:
- if energy <= 1 or mood <= 1, recommendations must be recovery-only.
- recommendations count must be 1..3.
- autopick must exist in recommendation ranks.
"""

import unittest


RECOVERY_LABEL = "回復"
AUTOPICK = "A"


def is_low_state(energy: int, mood: int) -> bool:
    return energy <= 1 or mood <= 1


def validate_council_policy(response: dict, card_by_id: dict, energy: int, mood: int):
    recommendations = response.get("recommendations", [])
    if not (1 <= len(recommendations) <= 3):
        return False, "recommendations must be 1..3"
    if response.get("autopick") != AUTOPICK:
        return False, "autopick must be A"

    seen = set()
    low = is_low_state(energy, mood)
    for rec in recommendations:
        rank = rec.get("rank")
        card_id = rec.get("card_id")
        if rank in seen:
            return False, f"duplicate rank: {rank}"
        seen.add(rank)

        card = card_by_id.get(card_id)
        if not card:
            return False, f"unknown card_id: {card_id}"
        if low and card.get("label") != RECOVERY_LABEL:
            return False, f"low state must be recovery only: {card_id}"

    if response.get("autopick") not in seen:
        return False, "autopick rank not found"
    return True, "ok"


class LowStatePolicyTests(unittest.TestCase):
    def setUp(self):
        self.cards = [
            {"card_id": "card_recover_001", "label": "回復"},
            {"card_id": "card_recover_002", "label": "回復"},
            {"card_id": "card_explore_001", "label": "探索"},
        ]
        self.card_by_id = {card["card_id"]: card for card in self.cards}

    def test_low_state_by_energy(self):
        response = {
            "recommendations": [{"rank": "A", "card_id": "card_recover_001"}],
            "autopick": "A",
        }
        ok, msg = validate_council_policy(response, self.card_by_id, energy=1, mood=2)
        self.assertTrue(ok, msg)

    def test_low_state_reject_non_recovery(self):
        response = {
            "recommendations": [{"rank": "A", "card_id": "card_explore_001"}],
            "autopick": "A",
        }
        ok, _ = validate_council_policy(response, self.card_by_id, energy=1, mood=2)
        self.assertFalse(ok)

    def test_normal_state_allows_non_recovery(self):
        response = {
            "recommendations": [
                {"rank": "A", "card_id": "card_explore_001"},
                {"rank": "B", "card_id": "card_recover_001"},
            ],
            "autopick": "A",
        }
        ok, msg = validate_council_policy(response, self.card_by_id, energy=2, mood=2)
        self.assertTrue(ok, msg)

    def test_autopick_must_exist(self):
        response = {
            "recommendations": [{"rank": "B", "card_id": "card_recover_001"}],
            "autopick": "A",
        }
        ok, _ = validate_council_policy(response, self.card_by_id, energy=2, mood=2)
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main()
