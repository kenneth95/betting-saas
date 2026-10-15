import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import datetime as dt

from betting_model.config import current_season


def test_season_is_the_year_it_started_in():
    assert current_season(dt.date(2026, 10, 15)) == 2026   # autumn: season just started
    assert current_season(dt.date(2026, 8, 15)) == 2026    # opening weekend


def test_spring_belongs_to_the_previous_years_season():
    assert current_season(dt.date(2027, 1, 10)) == 2026
    assert current_season(dt.date(2027, 5, 24)) == 2026    # final day


def test_rolls_over_in_july():
    assert current_season(dt.date(2027, 6, 30)) == 2026
    assert current_season(dt.date(2027, 7, 1)) == 2027
