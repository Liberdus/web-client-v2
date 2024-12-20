
interface AddFriendButtonProps {
  onClick: () => void;
}


export function AddFriendButton({ onClick }: AddFriendButtonProps) {
  return (
    <button onClick={onClick} className="bg-indigo-600 text-white rounded-full px-6 py-3 flex items-center gap-2 shadow-lg">
      <span className="text-2xl">+</span>
      <span>Add Friend</span>
    </button>
  );
}