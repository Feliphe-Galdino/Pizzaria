-- ServerScriptService/GerenciadorDeJogo (Script)
-- Cria os status do jogador, gera os inimigos, controla dano/morte e dá XP/nível a quem mata.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local Debris = game:GetService("Debris")

-- Configurações gerais
local VIDA_INIMIGO = 100
local XP_MIN_POR_INIMIGO = 15
local XP_MAX_POR_INIMIGO = 35
local TEMPO_RESPAWN = 5
local TAG_INIMIGO = "Inimigo"

local PONTOS_DE_SPAWN = {
	Vector3.new(20, 5, 0),
	Vector3.new(-20, 5, 0),
	Vector3.new(0, 5, 20),
	Vector3.new(0, 5, -20),
	Vector3.new(15, 5, 15),
	Vector3.new(-15, 5, -15),
}

-- RemoteEvents usados pela GUI (script 2) e pela espada (script 3)
local eventoInimigoMorto = ReplicatedStorage:FindFirstChild("InimigoMorto")
if not eventoInimigoMorto then
	eventoInimigoMorto = Instance.new("RemoteEvent")
	eventoInimigoMorto.Name = "InimigoMorto"
	eventoInimigoMorto.Parent = ReplicatedStorage
end

local eventoSubiuDeNivel = ReplicatedStorage:FindFirstChild("SubiuDeNivel")
if not eventoSubiuDeNivel then
	eventoSubiuDeNivel = Instance.new("RemoteEvent")
	eventoSubiuDeNivel.Name = "SubiuDeNivel"
	eventoSubiuDeNivel.Parent = ReplicatedStorage
end

local pastaInimigos = workspace:FindFirstChild("Inimigos")
if not pastaInimigos then
	pastaInimigos = Instance.new("Folder")
	pastaInimigos.Name = "Inimigos"
	pastaInimigos.Parent = workspace
end

-- Cria os status (leaderstats) de cada jogador que entra
Players.PlayerAdded:Connect(function(jogador)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = jogador

	local nivel = Instance.new("IntValue")
	nivel.Name = "Nível"
	nivel.Value = 1
	nivel.Parent = leaderstats

	local xp = Instance.new("IntValue")
	xp.Name = "XP"
	xp.Value = 0
	xp.Parent = leaderstats

	local mortes = Instance.new("IntValue")
	mortes.Name = "Mortes"
	mortes.Value = 0
	mortes.Parent = leaderstats
end)

local function xpNecessarioParaNivel(nivel)
	return nivel * 100
end

local function darXP(jogador, quantidade)
	local leaderstats = jogador:FindFirstChild("leaderstats")
	if not leaderstats then return end

	local xp = leaderstats:FindFirstChild("XP")
	local nivel = leaderstats:FindFirstChild("Nível")
	if not xp or not nivel then return end

	xp.Value += quantidade

	local subiuDeNivel = false
	while xp.Value >= xpNecessarioParaNivel(nivel.Value) do
		xp.Value -= xpNecessarioParaNivel(nivel.Value)
		nivel.Value += 1
		subiuDeNivel = true
	end

	if subiuDeNivel then
		eventoSubiuDeNivel:FireClient(jogador, nivel.Value)
	end
end

local function criarInimigo(posicao)
	local modelo = Instance.new("Model")
	modelo.Name = "Inimigo"

	local corpo = Instance.new("Part")
	corpo.Name = "HumanoidRootPart"
	corpo.Size = Vector3.new(2, 2, 1)
	corpo.Position = posicao
	corpo.BrickColor = BrickColor.new("Crimson")
	corpo.Material = Enum.Material.Neon
	corpo.Parent = modelo

	local cabeca = Instance.new("Part")
	cabeca.Name = "Head"
	cabeca.Shape = Enum.PartType.Ball
	cabeca.Size = Vector3.new(1.2, 1.2, 1.2)
	cabeca.Position = posicao + Vector3.new(0, 1.6, 0)
	cabeca.BrickColor = BrickColor.new("Really red")
	cabeca.Parent = modelo

	local solda = Instance.new("WeldConstraint")
	solda.Part0 = corpo
	solda.Part1 = cabeca
	solda.Parent = corpo

	local humanoid = Instance.new("Humanoid")
	humanoid.MaxHealth = VIDA_INIMIGO
	humanoid.Health = VIDA_INIMIGO
	humanoid.Parent = modelo

	modelo.PrimaryPart = corpo
	modelo.Parent = pastaInimigos

	CollectionService:AddTag(modelo, TAG_INIMIGO)

	humanoid.Died:Connect(function()
		local criador = humanoid:FindFirstChild("Criador")
		if criador and criador.Value then
			local jogador = criador.Value
			local xpGanho = math.random(XP_MIN_POR_INIMIGO, XP_MAX_POR_INIMIGO)
			darXP(jogador, xpGanho)

			local leaderstats = jogador:FindFirstChild("leaderstats")
			local mortes = leaderstats and leaderstats:FindFirstChild("Mortes")
			if mortes then
				mortes.Value += 1
			end

			eventoInimigoMorto:FireClient(jogador, xpGanho)
		end

		Debris:AddItem(modelo, 2)

		task.delay(TEMPO_RESPAWN, function()
			criarInimigo(PONTOS_DE_SPAWN[math.random(1, #PONTOS_DE_SPAWN)])
		end)
	end)
end

for i = 1, #PONTOS_DE_SPAWN do
	criarInimigo(PONTOS_DE_SPAWN[i])
end
