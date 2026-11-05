import type { DigestNight, DigestRow } from '../digest/types.js';

// Missing data renders as '—', never as an empty cell (styleguide).
const dash = '—';

function Row({ row }: { row: DigestRow }) {
  const retriesWarn = row.retries >= 3;
  const statusWarn = row.lastStatus === 'fail';
  return (
    <tr>
      <td>{row.job}</td>
      <td>{row.owner ?? dash}</td>
      <td>{row.runs}</td>
      <td>{retriesWarn ? <span class="warn">{row.retries}</span> : row.retries}</td>
      <td>{statusWarn ? <span class="warn">{row.lastStatus}</span> : row.lastStatus}</td>
      <td>{row.lastError ?? dash}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function Digest({ night }: { night: DigestNight }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first at</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <Row row={row} />
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && (
        <p class="mute">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} didn't parse
        </p>
      )}
    </>
  );
}
