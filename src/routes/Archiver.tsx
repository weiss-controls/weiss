// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import NavBar from "@src/components/NavBar/NavBar";

import "../App.css";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { echarts, type ECOption } from "@src/utils/eChartsMinified";
import { useEffect, useState } from "react";
import { COLORS } from "@src/constants/constants";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useSearchParams } from "react-router-dom";
import Typography from "@mui/material/Typography";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import PvSearchBox from "@src/components/PvSearchBox/PvSearchBox";
import Skeleton from "@mui/material/Skeleton";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

const MS_IN_MINUTE = 60000;

interface ArchiverData {
  millis: number;
  val: number;
}

interface ArchiverPv {
  meta: {
    name: string;
    EGU: string;
  };
  data: ArchiverData[];
}

export default function Archiver() {
  const now = new Date();

  const [selectedTimePreset, setSelectedTimePreset] = useState("5");
  const [searchParams, setSearchParams] = useSearchParams({ end: now.toISOString() });
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ArchiverPv[] | null>(null);

  const timeRangeStart =
    searchParams.get("start") ?? new Date(now.getTime() - 5 * MS_IN_MINUTE).toISOString();
  const timeRangeEnd = searchParams.get("end") ?? now.toISOString();

  const updatePvs = (_: any, newPvs: string[]) => {
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete("pv");
      newPvs.forEach((pv) => next.append("pv", pv));
      return next;
    });
  };

  const updateTimeRangeFromPreset = (_: any, timePreset: string) => {
    // TODO: this can be converted to use the new Temporal API, which is better

    setSelectedTimePreset(timePreset);
    if (timePreset === "YTD") {
      const start = new Date(now.getFullYear(), 0, 1);
      setSearchParams((sp) => {
        sp.set("start", start.toISOString());
        sp.set("end", now.toISOString());
        return sp;
      });
    } else {
      const timeInPastInMinutes = Number(timePreset);
      setSearchParams((sp) => {
        sp.set("start", new Date(now.getTime() - timeInPastInMinutes * MS_IN_MINUTE).toISOString());
        sp.set("end", now.toISOString());
        return sp;
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const requests = searchParams.getAll("pv").flatMap(async (pvName) => {
        // Note that optimisation options are still to be expanded; I feel like all optimisation methods provided
        // by EPICS Archiver are a bit unwieldy and produce bad data, but we need this option nonetheless
        const optName = searchParams.get("optimise") === "true" ? `mean_60(${pvName})` : pvName;
        const timeRange = `from=${timeRangeStart}&to=${timeRangeEnd}`;
        const response = await fetch(
          `${import.meta.env.VITE_EPICS_ARCHIVER_URL}/retrieval/data/getData.qw?pv=${optName}&${timeRange}&fetchLatestMetadata=true`,
        );

        if (!response.ok) {
          console.error(`Failed to fetch data for PV: ${pvName}`);
          return null;
        }

        return await response.json();
      });

      const pvData = await Promise.all(requests);
      const filteredPvData = pvData.flatMap((pv) => (pv ? pv : []));
      setIsLoading(false);
      setData(filteredPvData);
    };

    fetchData();
  }, [searchParams]);

  const toggleOptimise = () => {
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      const isOptimised = next.get("optimise") === "true";
      next.set("optimise", String(!isOptimised));
      return next;
    });
  };

  const series: ECOption["series"] = data
    ? data.map((pv) => ({
        data: data ? pv.data.map((item) => [item.millis, item.val]) : [],
        type: "line",
        smooth: false,
        showSymbol: false,
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: 12,
        },
        name: `${pv.meta.name} (${pv.meta.EGU ?? "No EGU"})`,
      }))
    : [];

  const option: ECOption = {
    xAxis: {
      type: "time",
      name: "Time",
    },
    legend: {
      show: true,
    },
    yAxis: {
      type: "value",
      name: "Value",
    },
    series,
  };

  return (
    <div className="app">
      <div className="appBar">
        <NavBar />
      </div>

      <Stack direction="column" style={{ marginTop: "90px", height: "100%" }}>
        <Stack direction="row" style={{ width: "100%", justifyContent: "center" }} spacing="1em">
          <ToggleButtonGroup
            value={selectedTimePreset}
            exclusive
            onChange={updateTimeRangeFromPreset}
            aria-label="Time Range Preset"
            size="small"
            style={{ height: "56px" }}
          >
            <ToggleButton value="YTD">YTD</ToggleButton>
            <ToggleButton value="5">5m</ToggleButton>
            <ToggleButton value="60">1h</ToggleButton>
            <ToggleButton value="360">6h</ToggleButton>
            <ToggleButton value="1440">1d</ToggleButton>
            <ToggleButton value="10080">1w</ToggleButton>
            <ToggleButton value="20160">2w</ToggleButton>
            <ToggleButton value="43830">1M</ToggleButton>
            <ToggleButton value="262980">6M</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="Start"
            type="datetime-local"
            slotProps={{
              htmlInput: {
                style: { height: "56px", padding: "0 10px" },
                step: 1,
                max: now.toISOString().slice(0, 19),
              },
              inputLabel: { shrink: true },
            }}
            value={timeRangeStart.slice(0, 19)}
          />
          <TextField
            label="End"
            type="datetime-local"
            slotProps={{
              htmlInput: { style: { height: "56px", padding: "0 10px" }, step: 1 },
              inputLabel: { shrink: true },
            }}
            value={timeRangeEnd.slice(0, 19)}
          />
          <PvSearchBox onChange={updatePvs} value={searchParams.getAll("pv")} />
          <FormControlLabel
            label="Optimise"
            control={<Checkbox onChange={toggleOptimise} value={searchParams.get("optimise")} />}
          />
        </Stack>
        {isLoading ? (
          <Skeleton />
        ) : series.length > 0 ? (
          <ReactEChartsCore
            style={{ width: "100%", flex: "1 0 0" }}
            echarts={echarts}
            option={option}
          />
        ) : (
          <Typography
            variant="h2"
            style={{ width: "100%", textAlign: "center", paddingTop: "1em" }}
          >
            No valid PV provided
          </Typography>
        )}
      </Stack>
    </div>
  );
}
