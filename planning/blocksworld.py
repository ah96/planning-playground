"""Blocks world: the domain every planning course starts with, and why.

A grid tells you what *search* is.  Blocks world tells you what an *action* is:
a name, a list of conditions that must hold before you may use it, and a list of
facts it adds and deletes.  That triple is all a PDDL domain file contains, so
whoever understands it understands the input format of every classical planner.

    unstack(x, y)
      pre:  on(x, y), clear(x), handempty
      add:  holding(x), clear(y)
      del:  on(x, y), clear(x), handempty

The state is kept as stacks plus whatever the gripper holds, because that is
trivially canonical -- two states are the same exactly when their sorted stacks
and their held block agree.  The predicates a planner would see are derived from
it on demand, for display.
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = ["State", "Action", "BlocksProblem", "predicates", "describe_action"]

PICKUP, PUTDOWN, STACK, UNSTACK = "pickup", "putdown", "stack", "unstack"


@dataclass(frozen=True)
class State:
    """Stacks listed bottom-to-top, plus the block in the gripper (or None)."""

    stacks: tuple[tuple[str, ...], ...]
    holding: str | None = None

    @staticmethod
    def of(stacks, holding: str | None = None) -> "State":
        clean = tuple(tuple(s) for s in stacks if s)
        return State(tuple(sorted(clean)), holding)

    @property
    def key(self) -> tuple:
        return (self.stacks, self.holding)

    @property
    def blocks(self) -> list[str]:
        out = [b for s in self.stacks for b in s]
        if self.holding:
            out.append(self.holding)
        return sorted(out)

    def top_of(self, stack: tuple[str, ...]) -> str:
        return stack[-1]


@dataclass(frozen=True)
class Action:
    """One grounded action: ``stack('A', 'B')`` and friends."""

    name: str
    args: tuple[str, ...]

    def __str__(self) -> str:
        return f"{self.name}({', '.join(self.args)})"

    @property
    def as_dict(self) -> dict:
        return {"name": self.name, "args": list(self.args), "text": str(self)}


def predicates(state: State) -> list[str]:
    """The STRIPS facts that hold in this state, in a stable order."""
    facts: list[str] = []
    for stack in state.stacks:
        facts.append(f"ontable({stack[0]})")
        for lower, upper in zip(stack, stack[1:]):
            facts.append(f"on({upper}, {lower})")
        facts.append(f"clear({stack[-1]})")
    if state.holding:
        facts.append(f"holding({state.holding})")
    else:
        facts.append("handempty")
    return sorted(facts)


def describe_action(action: Action, before: State) -> dict:
    """Preconditions and effects of one action, with each precondition checked.

    The UI shows this next to the step being played, so the audience can see
    that the planner is not guessing: every condition on the left was true in
    the state on the left.
    """
    held = before.holding
    facts = set(predicates(before))
    if action.name == PICKUP:
        (x,) = action.args
        pre = [f"ontable({x})", f"clear({x})", "handempty"]
        add, dele = [f"holding({x})"], [f"ontable({x})", f"clear({x})", "handempty"]
    elif action.name == PUTDOWN:
        (x,) = action.args
        pre = [f"holding({x})"]
        add, dele = [f"ontable({x})", f"clear({x})", "handempty"], [f"holding({x})"]
    elif action.name == UNSTACK:
        x, y = action.args
        pre = [f"on({x}, {y})", f"clear({x})", "handempty"]
        add, dele = [f"holding({x})", f"clear({y})"], [f"on({x}, {y})", f"clear({x})", "handempty"]
    elif action.name == STACK:
        x, y = action.args
        pre = [f"holding({x})", f"clear({y})"]
        add, dele = [f"on({x}, {y})", f"clear({x})", "handempty"], [f"holding({x})", f"clear({y})"]
    else:
        raise ValueError(f"unknown action {action.name!r}")
    _ = held
    return {
        "action": action.as_dict,
        "pre": [{"fact": f, "holds": f in facts} for f in pre],
        "add": add,
        "del": dele,
    }


@dataclass
class BlocksProblem:
    """An initial arrangement plus a partial goal, e.g. ``on(A,B)`` and ``on(B,C)``."""

    start: State
    goal_facts: tuple[str, ...]

    def __post_init__(self) -> None:
        self.goal_set = set(self.goal_facts)
        known = set(self.start.blocks)
        for fact in self.goal_set:
            for name in _facts_mentioning(fact):
                if name not in known:
                    raise ValueError(f"the goal mentions block {name!r}, which is not on the table")

    # -------------------------------------------------------------- problem
    @property
    def initial(self) -> State:
        return self.start

    def is_goal(self, state: State) -> bool:
        return self.goal_set.issubset(set(predicates(state)))

    def key(self, state: State):
        return state.key

    def successors(self, state: State):
        if state.holding is None:
            for stack in state.stacks:
                top = stack[-1]
                rest = stack[:-1]
                others = tuple(s for s in state.stacks if s != stack)
                if len(stack) == 1:
                    yield (Action(PICKUP, (top,)), State.of(others, top), 1.0)
                else:
                    below = stack[-2]
                    yield (Action(UNSTACK, (top, below)), State.of(others + (rest,), top), 1.0)
        else:
            x = state.holding
            yield (Action(PUTDOWN, (x,)), State.of(state.stacks + ((x,),), None), 1.0)
            for stack in state.stacks:
                target = stack[-1]
                others = tuple(s for s in state.stacks if s != stack)
                yield (Action(STACK, (x, target)), State.of(others + (stack + (x,),), None), 1.0)

    def heuristic(self, state: State) -> float:
        """How many goal facts are still false.

        Admissible: every action adds at most one ``on``/``ontable`` fact, so no
        plan can close more than one unit of this estimate per step.  That is
        the property A* needs, and it is short enough to say out loud.
        """
        facts = set(predicates(state))
        return float(sum(1 for f in self.goal_set if f not in facts))


def _facts_mentioning(fact: str) -> list[str]:
    inside = fact[fact.index("(") + 1: fact.rindex(")")]
    return [part.strip() for part in inside.split(",") if part.strip()]
