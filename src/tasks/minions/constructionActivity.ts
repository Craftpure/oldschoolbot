import { Task } from 'klasa';

import Constructables from '../../lib/skilling/skills/construction/constructables';
import { SkillsEnum } from '../../lib/skilling/types';
import { ConstructionActivityTaskOptions } from '../../lib/types/minions';
import { calcPercentOfNum } from '../../lib/util';
import { calcConBonusXP } from '../../lib/util/calcConBonusXP';
import { handleTripFinish } from '../../lib/util/handleTripFinish';

export default class extends Task {
	async run(data: ConstructionActivityTaskOptions) {
		const { objectID, quantity, userID, channelID, duration } = data;
		const user = await this.client.users.fetch(userID);
		user.incrementMinionDailyDuration(duration);
		const currentLevel = user.skillLevel(SkillsEnum.Construction);
		const object = Constructables.find(object => object.id === objectID)!;
		const xpReceived = quantity * object.xp;
		let bonusXP = 0;
		const outfitMultiplier = calcConBonusXP(user.getGear('skilling'));
		if (outfitMultiplier > 0) {
			bonusXP = calcPercentOfNum(outfitMultiplier, xpReceived);
		}
		await user.addXP(SkillsEnum.Construction, xpReceived + bonusXP);
		const newLevel = user.skillLevel(SkillsEnum.Construction);

		let str = `${user}, ${user.minionName} finished constructing ${quantity}x ${
			object.name
		}, you also received ${xpReceived.toLocaleString()} XP.`;

		if (bonusXP > 0) {
			str += `\nYou received ${bonusXP.toLocaleString()} bonus XP from your Carpenter's outfit.`;
		}

		if (newLevel > currentLevel) {
			str += `\n\n${user.minionName}'s Construction level is now ${newLevel}!`;
		}

		handleTripFinish(
			this.client,
			user,
			channelID,
			str,
			res => {
				user.log(`continued trip of ${quantity}x ${object.name}[${object.id}]`);
				return this.client.commands.get('build')!.run(res, [quantity, object.name]);
			},
			undefined,
			data,
			null
		);
	}
}
