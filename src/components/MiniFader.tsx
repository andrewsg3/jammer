import { VerticalFader } from './VerticalFader';

type Props = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

/** A bare vertical fader + label, no style/sound dropdowns — for a track's sub-mix. */
export function MiniFader({ id, label, value, onChange }: Props) {
  return (
    <div className="channel-strip channel-strip-mini">
      <VerticalFader id={id} value={value} onChange={onChange} />
      <span className="channel-strip-label">{label}</span>
    </div>
  );
}
