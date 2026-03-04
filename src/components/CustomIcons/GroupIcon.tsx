// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

const CustomGroupIcon: React.FC<SvgIconProps> = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d="M4 5h1V4h8v5h1V3H5V2H2v3h1v9h6v-1H4zM3 3h1v1H3zM2 22h3v-3H2zm1-2h1v1H3zM19 2v3h3V2zm2 2h-1V3h1zm0 6H10v11h9v1h3v-3h-1zm-2 10h-8v-9h9v8h-1zm2 1h-1v-1h1z"
        fill="currentColor"
      />
      <path fill="none" d="M0 0h24v24H0z" />
    </SvgIcon>
  );
};

export default CustomGroupIcon;
