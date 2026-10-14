"use client";
import { useId } from "react";
import { type Person, samplePerson } from "@/domain/model";
export default function PersonForm({
  person,
  onChange,
  other = false,
}: {
  person: Person;
  onChange: (p: Person) => void;
  other?: boolean;
}) {
  const id = useId();
  const change = (key: keyof Person, value: string | boolean) =>
    onChange({ ...person, [key]: value });
  return (
    <div className="person-form">
      <div className="row between">
        <h2>{other ? "상대방" : "나"}의 정보</h2>
        <button
          type="button"
          className="text-button"
          onClick={() => onChange({ ...samplePerson(other), id: person.id })}
        >
          가상 정보 채우기
        </button>
      </div>
      <label htmlFor={`${id}-name`}>부를 이름</label>
      <input
        id={`${id}-name`}
        value={person.name}
        maxLength={10}
        onChange={(e) => change("name", e.target.value)}
        placeholder="별명 1~10자"
        autoComplete="off"
      />
      {other && (
        <>
          <label htmlFor={`${id}-relation`}>어떤 사이인가요?</label>
          <select
            id={`${id}-relation`}
            value={person.relation}
            onChange={(e) => change("relation", e.target.value)}
          >
            {["친구", "연인", "가족", "동료"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </>
      )}
      <fieldset>
        <legend>생년월일</legend>
        <div className="date-grid">
          {(["year", "month", "day"] as const).map((key, i) => (
            <label key={key} htmlFor={`${id}-${key}`}>
              <span className="field-caption">{["년", "월", "일"][i]}</span>
              <input
                id={`${id}-${key}`}
                inputMode="numeric"
                value={person[key]}
                maxLength={i === 0 ? 4 : 2}
                onChange={(e) => change(key, e.target.value.replace(/\D/g, ""))}
                placeholder={["1990", "3", "12"][i]}
              />
            </label>
          ))}
        </div>
        <div className="row">
          {(["solar", "lunar"] as const).map((x) => (
            <label key={x} className="choice">
              <input
                type="radio"
                name={`${id}-calendar`}
                checked={person.calendar === x}
                onChange={() =>
                  onChange({ ...person, calendar: x, leap: false })
                }
              />
              {x === "solar" ? "양력" : "음력"}
            </label>
          ))}
          {person.calendar === "lunar" && (
            <label className="choice">
              <input
                type="checkbox"
                checked={person.leap}
                onChange={(e) => change("leap", e.target.checked)}
              />
              윤달
            </label>
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend>태어난 시간</legend>
        <label className="choice">
          <input
            type="checkbox"
            checked={!person.timeKnown}
            onChange={(e) =>
              onChange({
                ...person,
                timeKnown: !e.target.checked,
                hour: "",
                minute: "",
              })
            }
          />
          시간을 몰라요
        </label>
        {person.timeKnown && (
          <div className="time-grid">
            {(["hour", "minute"] as const).map((key, i) => (
              <label htmlFor={`${id}-${key}`} key={key}>
                {i === 0 ? "시 (0~23)" : "분 (0~59)"}
                <input
                  id={`${id}-${key}`}
                  inputMode="numeric"
                  value={person[key]}
                  maxLength={2}
                  onChange={(e) =>
                    change(key, e.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <p className="hint">
        국내 출생 기준 · 1908~2026년 연구 범위
        <br />
        시간을 모르면 시주를 만들지 않아요.
      </p>
    </div>
  );
}
