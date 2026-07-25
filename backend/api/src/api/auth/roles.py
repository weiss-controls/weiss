# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from fastapi import Depends, HTTPException, status

from . import User, UserRole, get_current_user


def require_developer(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.DEVELOPER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer role required",
        )
    return user
