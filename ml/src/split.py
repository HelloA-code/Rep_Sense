"""Train/test folds that keep each person (or at least each clip) on one side.

Neighbouring windows overlap, so a random split would test on almost-identical copies
of the training data. Splitting by person answers the real question: does this work on
someone the model has never seen?
"""

import numpy as np
from sklearn.model_selection import GroupKFold

MIN_PEOPLE = 3
MAX_FOLDS = 6


def make_folds(subjects: np.ndarray, clips: np.ndarray) -> tuple[list[tuple[np.ndarray, np.ndarray]], str]:
    """Returns the folds and "person" or "clip" for which split was possible."""
    people = np.unique(subjects)
    if len(people) >= MIN_PEOPLE:
        groups, method = subjects, "person"
    else:
        groups, method = clips, "clip"
    count = len(np.unique(groups))
    if count < 2:
        raise SystemExit("Need at least 2 clips to evaluate a model.")
    return list(GroupKFold(n_splits=min(count, MAX_FOLDS)).split(subjects, groups=groups)), method
