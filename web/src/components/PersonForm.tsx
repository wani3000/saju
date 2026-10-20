"use client";
import { useId, useRef, useState } from "react";
import { type Person, samplePerson } from "@/domain/model";
import { personInputErrors, type InputField } from "@/domain/person-input";
export default function PersonForm({
  person,
  onChange,
  other = false,
  onContinue,
  busy,
  saved,
}: {
  person: Person;
  onChange: (p: Person) => void;
  other?: boolean;
  onContinue: () => void;
  busy: boolean;
  saved: string;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [attempted, setAttempted] = useState(false);
  const errors = attempted ? personInputErrors(person) : {};
  const fieldProps = (key: InputField) => ({
    "aria-invalid": errors[key] ? (true as const) : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const fieldError = (key: InputField) =>
    errors[key] ? (
      <span className="field-error" id={`${id}-${key}-error`}>
        {errors[key]}
      </span>
    ) : null;
  const change = (key: keyof Person, value: string | boolean) =>
    onChange({ ...person, [key]: value });
  return (
    <form
      className="person-form record-form"
      ref={form}
      noValidate
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setAttempted(true);
        if (Object.keys(personInputErrors(person)).length) {
          requestAnimationFrame(() =>
            form.current
              ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
              ?.focus(),
          );
          return;
        }
        onContinue();
      }}
    >
      <div className="row between record-heading">
        <h2>{other ? "상대방" : "나"}의 정보</h2>
        <button
          type="button"
          className="text-button"
          onClick={() => onChange({ ...samplePerson(other), id: person.id })}
        >
          가상 정보 채우기
        </button>
      </div>
      {Object.keys(errors).length > 0 && (
        <p className="error" role="alert">
          입력한 내용을 확인해 주세요. 수정할 곳을 각 입력칸 아래에 표시했어요.
        </p>
      )}
      <label htmlFor={`${id}-name`}>부를 이름</label>
      <input
        id={`${id}-name`}
        {...fieldProps("name")}
        value={person.name}
        maxLength={10}
        onChange={(e) => change("name", e.target.value)}
        placeholder="별명 1~10자"
        autoComplete="off"
      />
      {fieldError("name")}
      <p className="hint">본명 대신 별명을 적어도 괜찮아요.</p>
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
      <fieldset className="record-field">
        <legend>생년월일</legend>
        <div className="date-grid">
          {(["year", "month", "day"] as const).map((key, i) => (
            <div key={key}>
              <label htmlFor={`${id}-${key}`}>
                <span className="field-caption">{["년", "월", "일"][i]}</span>
                <input
                  id={`${id}-${key}`}
                  {...fieldProps(key)}
                  inputMode="numeric"
                  value={person[key]}
                  maxLength={i === 0 ? 4 : 2}
                  onChange={(e) =>
                    change(key, e.target.value.replace(/\D/g, ""))
                  }
                  placeholder={["1990", "3", "12"][i]}
                />
              </label>
              {fieldError(key)}
            </div>
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
      <fieldset className="record-field">
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
              <div key={key}>
                <label htmlFor={`${id}-${key}`}>
                  {i === 0 ? "시 (0~23)" : "분 (0~59)"}
                  <input
                    id={`${id}-${key}`}
                    {...fieldProps(key)}
                    inputMode="numeric"
                    value={person[key]}
                    maxLength={2}
                    onChange={(e) =>
                      change(key, e.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
                {fieldError(key)}
              </div>
            ))}
          </div>
        )}
      </fieldset>
      <p className="hint">
        국내 출생 기준 · 1908~2026년 연구 범위
        <br />
        시간을 모르면 시주를 만들지 않아요.
      </p>
      <p className="save-status" role="status">
        {saved}
      </p>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "저장 중…" : "저장하고 다음"}
      </button>
    </form>
  );
}
