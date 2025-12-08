import psycopg2
import json
import sys

from datetime import datetime


def main(table_name):
    # Adjust password/host/port as needed
    conn = psycopg2.connect(
        dbname="postmill",
        user="postgres",
    )

    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM {table_name} WHERE timestamp >= '2023-02-19 00:00:00' ORDER BY timestamp ASC;"
            )
            colnames = [desc[0] for desc in cur.description]
            record = {}
            for row in cur.fetchall():
                vals = []
                for v in row:
                    if isinstance(v, datetime):
                        vals.append(v.isoformat())
                    else:
                        vals.append(v)
                assert len(vals) == len(colnames)
                for i in range(len(colnames)):
                    record[colnames[i]] = vals[i]
                print(
                    json.dumps(
                        {
                            "time": record["timestamp"],
                            "type": table_name.removesuffix(
                                "s"
                            ),  # submissions -> submission, etc.
                            "payload": record,
                        }
                    )
                )

    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write(
            f"SYNTAX: python dump_table.py <TABLE_NAME>\n\nTables include:\n  submissions\n  comments\n"
        )
        sys.exit(1)
    else:
        main(sys.argv[1])
