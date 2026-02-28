import { Link } from "react-router-dom";

export default function PlayersPage() {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-bold">Players</h1>
      <p className="mt-2 text-sm text-gray-600">
        List/Search/Filter will go here.
      </p>

      <div className="mt-4">
        <Link className="text-sm underline" to="/players/123">
          Go to a stub Player Detail (/players/123)
        </Link>
      </div>
    </div>
  );
}