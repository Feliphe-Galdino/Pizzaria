-- StarterPack/EspadaDoCacador/DanoDaEspada (Script, dentro da Tool "EspadaDoCacador")
-- Detecta o golpe da espada, aplica dano só em modelos marcados como "Inimigo"
-- e marca quem foi o autor do dano (usado pelo GerenciadorDeJogo para dar o XP).

local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local DANO = 34
local TEMPO_DE_GOLPE = 0.4
local COOLDOWN = 0.5
local TAG_INIMIGO = "Inimigo"

local ferramenta = script.Parent
local cabo = ferramenta:WaitForChild("Handle")

local podeAtacar = true

local function golpear()
	if not podeAtacar then return end
	podeAtacar = false

	local jaAtingidos = {}

	local conexao
	conexao = cabo.Touched:Connect(function(parteAtingida)
		local modeloInimigo = parteAtingida:FindFirstAncestorOfClass("Model")
		if not modeloInimigo then return end
		if not CollectionService:HasTag(modeloInimigo, TAG_INIMIGO) then return end
		if jaAtingidos[modeloInimigo] then return end

		local humanoid = modeloInimigo:FindFirstChildOfClass("Humanoid")
		if not humanoid or humanoid.Health <= 0 then return end

		jaAtingidos[modeloInimigo] = true

		local personagem = ferramenta.Parent
		local jogador = personagem and Players:GetPlayerFromCharacter(personagem)
		if jogador then
			local tagAntiga = humanoid:FindFirstChild("Criador")
			if tagAntiga then
				tagAntiga:Destroy()
			end

			local tag = Instance.new("ObjectValue")
			tag.Name = "Criador"
			tag.Value = jogador
			tag.Parent = humanoid
		end

		humanoid:TakeDamage(DANO)
	end)

	task.delay(TEMPO_DE_GOLPE, function()
		conexao:Disconnect()
	end)

	task.delay(COOLDOWN, function()
		podeAtacar = true
	end)
end

ferramenta.Activated:Connect(golpear)
