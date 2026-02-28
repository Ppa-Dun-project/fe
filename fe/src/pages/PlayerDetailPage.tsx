import { useParams, Link } from "react-router-dom";

export default function PlayerDetailPage() {
  const { id } = useParams();

  return (
    <div className="rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-bold">Player Detail</h1>
      <p className="mt-2 text-sm text-gray-600">Player ID: {id}</p>

      <div className="mt-4 flex gap-3">
        <Link className="text-sm underline" to="/players">
          Back to Players
        </Link>
      </div>
    </div>
  );
}