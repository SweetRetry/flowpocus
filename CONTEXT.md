# Flowpocus

A real-time collaborative canvas edited by people in the browser and by agents through server-owned commands.

## Language

### Placement

**Owner**:
The one backend instance that has a canvas's live document loaded. Every other instance forwards that canvas's traffic to it.
_Avoid_: primary, leader, master node

**Lease**:
A time-limited claim that makes an instance the Owner of one canvas. It lapses unless renewed.
_Avoid_: lock
