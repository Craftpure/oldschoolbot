import { Task } from 'klasa';
import LootTable from 'oldschooljs/dist/structures/LootTable';

import {
	HighSeedPackTable,
	LowSeedPackTable,
	MediumSeedPackTable
} from '../../commands/Minion/seedpack';
import { Emoji, Events, Time } from '../../lib/constants';
import addSkillingClueToLoot from '../../lib/minions/functions/addSkillingClueToLoot';
import { getRandomMysteryBox } from '../../lib/openables';
import Woodcutting from '../../lib/skilling/skills/woodcutting';
import { SkillsEnum } from '../../lib/skilling/types';
import { WoodcuttingActivityTaskOptions } from '../../lib/types/minions';
import { addItemToBank, itemID, multiplyBank, roll } from '../../lib/util';
import createReadableItemListFromBank from '../../lib/util/createReadableItemListFromTuple';
import { handleTripFinish } from '../../lib/util/handleTripFinish';

const SeedTable = new LootTable()
	.every(LowSeedPackTable)
	.add(LowSeedPackTable, 1, 4)
	.add(MediumSeedPackTable, 1, 2)
	.add(HighSeedPackTable);

export default class extends Task {
	async run({ logID, quantity, userID, channelID, duration }: WoodcuttingActivityTaskOptions) {
		const user = await this.client.users.fetch(userID);
		user.incrementMinionDailyDuration(duration);
		const currentLevel = user.skillLevel(SkillsEnum.Woodcutting);

		const Log = Woodcutting.Logs.find(Log => Log.id === logID);

		if (!Log) return;

		const xpReceived = quantity * Log.xp;

		await user.addXP(SkillsEnum.Woodcutting, xpReceived);
		const newLevel = user.skillLevel(SkillsEnum.Woodcutting);

		let str = `${user}, ${user.minionName} finished Woodcutting ${quantity} ${
			Log.name
		}, you also received ${xpReceived.toLocaleString()} XP.`;

		if (newLevel > currentLevel) {
			str += `\n\n${user.minionName}'s Woodcutting level is now ${newLevel}!`;
		}

		let loot = {
			[Log.id]: quantity
		};

		if (roll(10)) {
			if (duration > Time.Minute * 10) {
				loot = multiplyBank(loot, 2);
				loot[getRandomMysteryBox()] = 1;
			}
		}

		const minutes = duration / Time.Minute;
		if (user.equippedPet() === itemID('Peky')) {
			for (let i = 0; i < minutes; i++) {
				if (roll(10)) {
					let items = SeedTable.roll();
					for (const res of items) {
						loot = addItemToBank(loot, res.item, res.quantity);
					}
				}
			}
		}

		// Add clue scrolls
		if (Log.clueScrollChance) {
			loot = addSkillingClueToLoot(
				user,
				SkillsEnum.Woodcutting,
				quantity,
				Log.clueScrollChance,
				loot
			);
		}

		// Roll for pet
		if (
			Log.petChance &&
			roll((Log.petChance - user.skillLevel(SkillsEnum.Woodcutting) * 25) / quantity)
		) {
			loot[itemID('Beaver')] = 1;
			str += `\nYou have a funny feeling you're being followed...`;
			this.client.emit(
				Events.ServerNotification,
				`${Emoji.Woodcutting} **${user.username}'s** minion, ${user.minionName}, just received a Beaver while cutting ${Log.name} at level ${currentLevel} Woodcutting!`
			);
		}

		str += `\n\nYou received: ${await createReadableItemListFromBank(this.client, loot)}.`;

		await user.addItemsToBank(loot, true);

		handleTripFinish(this.client, user, channelID, str, res => {
			user.log(`continued trip of ${quantity}x ${Log.name}[${Log.id}]`);
			return this.client.commands.get('chop')!.run(res, [quantity, Log.name]);
		});
	}
}
